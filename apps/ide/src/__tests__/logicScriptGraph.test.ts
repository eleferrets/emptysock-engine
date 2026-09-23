import { describe, it, expect } from "vitest";
import {
  makeLogicNode,
  toVisualScriptGraph,
  connectionId,
} from "../components/panels/visual-script/logicHelpers";
import type { LogicGraphState } from "../components/panels/visual-script/logicTypes";
import {
  VariableStore,
  ActorSystem,
  Actor,
  Game,
  defineScene,
  VisualScriptSystem,
  VisualScriptState,
  registerVisualScriptGraph,
} from "@emptysock/engine";
import type { Message } from "@emptysock/engine";

async function makeScene() {
  const game = new Game();
  const { scene } = await game.loadScene(defineScene({}), {
    manageLifecycle: false,
  });
  return scene;
}

describe("Logic Script panel save path -> VisualScriptGraph parity", () => {
  it("builds a graph via the panel's node/connection shape that VisualScriptSystem runs directly", async () => {
    // Simulates what the panel's canvas produces: nodes placed with x/y, wired
    // via click-to-connect, saved through toVisualScriptGraph() — the exact
    // function the panel's store-sync effect calls on every change.
    const start = makeLogicNode("onUpdate", 0, 0);
    const branch = makeLogicNode("branch", 200, 0);
    branch.variableIndex = 10;
    branch.comparator = "gt";
    branch.value = 2;

    const onTrue = makeLogicNode("setVariable", 400, -40);
    onTrue.variableIndex = 20;
    onTrue.value = 1;

    const onFalse = makeLogicNode("setVariable", 400, 40);
    onFalse.variableIndex = 20;
    onFalse.value = 2;

    const state: LogicGraphState = {
      nodes: [start, branch, onTrue, onFalse],
      connections: [
        {
          id: connectionId(start.id, branch.id, 0),
          from: start.id,
          to: branch.id,
          fromPort: 0,
        },
        {
          id: connectionId(branch.id, onTrue.id, 0),
          from: branch.id,
          to: onTrue.id,
          fromPort: 0,
        },
        {
          id: connectionId(branch.id, onFalse.id, 1),
          from: branch.id,
          to: onFalse.id,
          fromPort: 1,
        },
      ],
    };

    const graph = toVisualScriptGraph(state);

    // No editor-only fields leak into the saved shape.
    for (const node of graph.nodes) {
      expect(node).not.toHaveProperty("x");
      expect(node).not.toHaveProperty("y");
    }

    const store = new VariableStore();
    store.setVar(10, 3);

    // Zero translation: the saved graph drops straight into the real ECS system.
    registerVisualScriptGraph("panel-test-graph", graph);
    const scene = await makeScene();
    const entity = scene.spawn();
    entity.add(VisualScriptState, { graphId: "panel-test-graph" });
    const system = new VisualScriptSystem({ variables: store });
    system.update(scene);

    expect(store.getVar(20)).toBe(1);

    store.setVar(10, 1);
    store.setVar(20, 0);
    system.update(scene);
    expect(store.getVar(20)).toBe(2);
  });

  it("a sendMessage node built by the panel dispatches through a real ActorSystem", async () => {
    const received: Message[] = [];
    class Recorder extends Actor {
      receive(msg: Message): void {
        received.push(msg);
      }
    }
    const actors = new ActorSystem();
    actors.register(new Recorder("target"));

    const start = makeLogicNode("onEvent", 0, 0);
    start.eventType = "hit";
    const send = makeLogicNode("sendMessage", 200, 0);
    send.targetActorId = "target";
    send.messageType = "ping";

    const state: LogicGraphState = {
      nodes: [start, send],
      connections: [
        {
          id: connectionId(start.id, send.id, 0),
          from: start.id,
          to: send.id,
          fromPort: 0,
        },
      ],
    };

    const graph = toVisualScriptGraph(state);
    registerVisualScriptGraph("panel-test-graph-2", graph);
    const scene = await makeScene();
    const entity = scene.spawn();
    entity.add(VisualScriptState, { graphId: "panel-test-graph-2" });
    const system = new VisualScriptSystem({ actorSystem: actors });
    system.fireEvent(scene, "hit");
    actors.update(0.016);

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ type: "ping" });
  });
});

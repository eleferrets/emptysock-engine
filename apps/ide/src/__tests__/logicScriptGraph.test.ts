import { describe, it, expect } from "vitest";
import {
  makeLogicNode,
  toVisualScriptGraph,
  connectionId,
} from "../components/panels/visual-script/logicHelpers";
import type { LogicGraphState } from "../components/panels/visual-script/logicTypes";
import {
  VisualScriptComponent,
  VariableStore,
  ActorSystem,
  Actor,
} from "@emptysock/engine";
import type { Message } from "@emptysock/engine";

describe("Logic Script panel save path -> VisualScriptGraph parity", () => {
  it("builds a graph via the panel's node/connection shape that VisualScriptComponent runs directly", () => {
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

    // Zero translation: the saved graph drops straight into the real component.
    const vs = new VisualScriptComponent({ graph, variableStore: store });
    vs.update(0.016);

    expect(store.getVar(20)).toBe(1);

    store.setVar(10, 1);
    store.setVar(20, 0);
    vs.update(0.016);
    expect(store.getVar(20)).toBe(2);
  });

  it("a sendMessage node built by the panel dispatches through a real ActorSystem", () => {
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
    const vs = new VisualScriptComponent({ graph, actorSystem: actors });
    vs.fireEvent("hit");
    actors.update(0.016);

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ type: "ping" });
  });
});

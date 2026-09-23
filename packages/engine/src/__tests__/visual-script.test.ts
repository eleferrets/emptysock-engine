import { describe, it, expect } from "vitest";
import { Game, defineScene } from "../Game.js";
import type { Scene } from "../Scene.js";
import {
  VisualScriptState,
  registerVisualScriptGraph,
  unregisterVisualScriptGraph,
} from "../components/VisualScript.js";
import { VisualScriptSystem } from "../systems/VisualScriptSystem.js";
import { VisualScriptGraphBuilder } from "../components/VisualScript.js";
import { VariableStore } from "../systems/VariableStore.js";
import { ActorSystem } from "../ActorSystem.js";
import { Actor } from "../Actor.js";
import type { Message } from "../Actor.js";

async function makeScene(): Promise<Scene> {
  const game = new Game();
  const { scene } = await game.loadScene(defineScene({}), {
    manageLifecycle: false,
  });
  return scene;
}

describe("ECS VisualScriptSystem", () => {
  it("runs an onUpdate chain that sets a variable, shared across entities via graphId", async () => {
    const scene = await makeScene();
    const builder = new VisualScriptGraphBuilder();
    const start = builder.onUpdate();
    const setVar = builder.setVariable(0, 42);
    builder.connect(start, setVar);
    registerVisualScriptGraph("test-graph", builder.build());

    const variables = new VariableStore();
    const system = new VisualScriptSystem({ variables });

    const a = scene.spawn("a");
    const b = scene.spawn("b");
    a.add(VisualScriptState, { graphId: "test-graph" });
    b.add(VisualScriptState, { graphId: "test-graph" });

    system.update(scene);

    expect(variables.getVar(0)).toBe(42);
    unregisterVisualScriptGraph("test-graph");
  });

  it("does nothing for an entity whose graphId isn't registered", async () => {
    const scene = await makeScene();
    const system = new VisualScriptSystem();
    const entity = scene.spawn("orphan");
    entity.add(VisualScriptState, { graphId: "missing-graph" });

    expect(() => system.update(scene)).not.toThrow();
  });

  it("fires onEvent chains only for matching entities and can send actor messages", async () => {
    const scene = await makeScene();
    const received: Message[] = [];
    class Listener extends Actor {
      override receive(message: Message): void {
        received.push(message);
      }
    }

    const actorSystem = new ActorSystem();
    actorSystem.register(new Listener("listener"));

    const builder = new VisualScriptGraphBuilder();
    const onEvent = builder.onEvent("ping");
    const send = builder.sendMessage("listener", "pong");
    builder.connect(onEvent, send);
    registerVisualScriptGraph("event-graph", builder.build());

    const system = new VisualScriptSystem({ actorSystem });
    const entity = scene.spawn("listenerEntity");
    entity.add(VisualScriptState, { graphId: "event-graph" });

    system.fireEvent(scene, "ping");
    actorSystem.update(0);

    expect(received).toEqual([{ type: "pong" }]);
    unregisterVisualScriptGraph("event-graph");
  });

  it("clears an entity's evaluation scope on destroy so a pooled id doesn't inherit stale scope state", async () => {
    const scene = await makeScene();
    const builder = new VisualScriptGraphBuilder();
    const start = builder.onUpdate();
    const getVar = builder.getVariable(0, "x");
    builder.connect(start, getVar);
    registerVisualScriptGraph("scope-graph", builder.build());

    const system = new VisualScriptSystem();
    const entity = scene.spawn("scoped");
    entity.add(VisualScriptState, { graphId: "scope-graph" });

    system.update(scene);
    scene.destroy(entity);

    expect(() => system.update(scene)).not.toThrow();
    unregisterVisualScriptGraph("scope-graph");
  });
});

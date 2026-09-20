import { describe, it, expect } from "vitest";
import {
  VisualScriptComponent,
  VisualScriptGraphBuilder,
} from "../components/VisualScriptComponent.js";
import { VariableStore } from "../systems/VariableStore.js";
import { ActorSystem } from "../core/ActorSystem.js";
import { Actor } from "../core/Actor.js";
import type { Message } from "../core/Actor.js";

describe("VisualScriptComponent", () => {
  it("has the expected ComponentType key", () => {
    expect(VisualScriptComponent.TYPE).toBe("VisualScript");
    const vs = new VisualScriptComponent({ graph: { nodes: [], connections: [] } });
    expect(vs.type).toBe("VisualScript");
  });

  it("onUpdate node runs a sequence of set/get variable nodes in order", () => {
    const builder = new VisualScriptGraphBuilder();
    const store = new VariableStore();

    const start = builder.onUpdate();
    const setA = builder.setVariable(1, 5);
    const getA = builder.getVariable(1, "a");
    const setB = builder.setVariable(2, { fromKey: "a" });

    builder
      .connect(start, setA)
      .connect(setA, getA)
      .connect(getA, setB);

    const vs = new VisualScriptComponent({
      graph: builder.build(),
      variableStore: store,
    });

    expect(vs.update).toBeDefined();
    vs.update(0.016);

    expect(store.getVar(1)).toBe(5);
    expect(store.getVar(2)).toBe(5);
  });

  it("branch node takes the true edge when the comparison holds", () => {
    const builder = new VisualScriptGraphBuilder();
    const store = new VariableStore();
    store.setVar(10, 3);

    const start = builder.onUpdate();
    const branch = builder.branch(10, "gt", 2);
    const onTrue = builder.setVariable(20, 1);
    const onFalse = builder.setVariable(20, 2);

    builder
      .connect(start, branch)
      .connect(branch, onTrue, 0)
      .connect(branch, onFalse, 1);

    const vs = new VisualScriptComponent({ graph: builder.build(), variableStore: store });
    vs.update(0.016);

    expect(store.getVar(20)).toBe(1);
  });

  it("branch node takes the false edge when the comparison fails", () => {
    const builder = new VisualScriptGraphBuilder();
    const store = new VariableStore();
    store.setVar(10, 1);

    const start = builder.onUpdate();
    const branch = builder.branch(10, "gt", 2);
    const onTrue = builder.setVariable(20, 1);
    const onFalse = builder.setVariable(20, 2);

    builder
      .connect(start, branch)
      .connect(branch, onTrue, 0)
      .connect(branch, onFalse, 1);

    const vs = new VisualScriptComponent({ graph: builder.build(), variableStore: store });
    vs.update(0.016);

    expect(store.getVar(20)).toBe(2);
  });

  it("getSwitch/setSwitch nodes actually read and write VariableStore switches", () => {
    const builder = new VisualScriptGraphBuilder();
    const store = new VariableStore();

    const start = builder.onUpdate();
    const setSw = builder.setSwitch(1, true);
    const getSw = builder.getSwitch(1, "flag");
    const setVar = builder.setVariable(30, { fromKey: "flag" });

    builder
      .connect(start, setSw)
      .connect(setSw, getSw)
      .connect(getSw, setVar);

    const vs = new VisualScriptComponent({ graph: builder.build(), variableStore: store });
    vs.update(0.016);

    expect(store.getSwitch(1)).toBe(true);
    expect(store.getVar(30)).toBe(1);
  });

  it("sendMessage node dispatches a real ActorSystem message", () => {
    const received: Message[] = [];

    class Recorder extends Actor {
      receive(msg: Message): void {
        received.push(msg);
      }
    }

    const actors = new ActorSystem();
    actors.register(new Recorder("target"));

    const builder = new VisualScriptGraphBuilder();
    const start = builder.onUpdate();
    const send = builder.sendMessage("target", "ping", { power: 9 });
    builder.connect(start, send);

    const vs = new VisualScriptComponent({
      graph: builder.build(),
      actorSystem: actors,
    });
    vs.update(0.016);
    actors.update(0.016);

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ type: "ping", power: 9 });
  });

  it("fireEvent only runs onEvent nodes matching the fired eventType", () => {
    const builder = new VisualScriptGraphBuilder();
    const store = new VariableStore();

    const evtA = builder.onEvent("hit");
    const setA = builder.setVariable(1, 100);
    builder.connect(evtA, setA);

    const evtB = builder.onEvent("heal");
    const setB = builder.setVariable(2, 200);
    builder.connect(evtB, setB);

    const vs = new VisualScriptComponent({ graph: builder.build(), variableStore: store });
    vs.fireEvent("hit");

    expect(store.getVar(1)).toBe(100);
    expect(store.getVar(2)).toBe(0);
  });

  it("does not loop forever when a graph cycles back into itself", () => {
    const builder = new VisualScriptGraphBuilder();
    const store = new VariableStore();

    const start = builder.onUpdate();
    const seqA = builder.sequence();
    const setA = builder.setVariable(1, { fromKey: "nonexistent" });
    builder.connect(start, seqA);
    builder.connect(seqA, setA);
    // wire the sequence back to itself to form a cycle
    builder.connect(setA, seqA);

    const vs = new VisualScriptComponent({ graph: builder.build(), variableStore: store });

    expect(() => vs.update(0.016)).not.toThrow();
    // literal 0 from a missing scope key still gets applied on every pass
    expect(store.getVar(1)).toBe(0);
  });

  it("serialize includes the graph payload", () => {
    const builder = new VisualScriptGraphBuilder();
    const start = builder.onUpdate();
    builder.connect(start, builder.sequence());
    const vs = new VisualScriptComponent({ graph: builder.build() });

    const data = vs.serialize();
    expect(data["type"]).toBe("VisualScript");
    expect(data["graph"]).toEqual(vs.graph);
  });
});

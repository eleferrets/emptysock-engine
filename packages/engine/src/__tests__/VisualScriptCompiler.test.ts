import { describe, it, expect } from "vitest";
import ts from "typescript";
import {
  VisualScriptGraphBuilder,
  VisualScriptComponent,
} from "../components/VisualScriptComponent.js";
import {
  compileVisualScriptGraph,
  CompiledVisualScriptComponent,
} from "../systems/VisualScriptCompiler.js";
import { VariableStore } from "../systems/VariableStore.js";
import { ActorSystem } from "../core/ActorSystem.js";
import { Actor } from "../core/Actor.js";
import type { Message } from "../core/Actor.js";

describe("compileVisualScriptGraph", () => {
  it("emits syntactically valid JavaScript for a representative graph", () => {
    const builder = new VisualScriptGraphBuilder();
    const start = builder.onUpdate();
    const branch = builder.branch(10, "gt", 2);
    const onTrue = builder.setVariable(20, 1);
    const onFalse = builder.setVariable(20, { fromKey: "missing" });
    const evt = builder.onEvent("hit");
    const setSw = builder.setSwitch(1, true);
    const getSw = builder.getSwitch(1, "flag");
    const send = builder.sendMessage("target", "ping", { power: 9 });

    builder
      .connect(start, branch)
      .connect(branch, onTrue, 0)
      .connect(branch, onFalse, 1)
      .connect(evt, setSw)
      .connect(setSw, getSw)
      .connect(getSw, send);

    const code = compileVisualScriptGraph(builder.build());
    const result = ts.transpileModule(code, {
      reportDiagnostics: true,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    });
    expect(result.diagnostics?.length ?? 0).toBe(0);
  });

  it("emits literal API calls, not a generic interpreter dispatch", () => {
    const builder = new VisualScriptGraphBuilder();
    const start = builder.onUpdate();
    const send = builder.sendMessage("target", "ping", { power: 9 });
    builder.connect(start, send);

    const code = compileVisualScriptGraph(builder.build());
    expect(code).toContain('ctx.actorSystem.send("target"');
    expect(code).toContain('type: "ping"');
    expect(code).toContain('"power": 9');
    expect(code).not.toContain("interpretNode");
    expect(code).not.toContain("execute(node)");
  });

  it("compiled setVariable/getVariable behaves identically to the interpreter", () => {
    const builder = new VisualScriptGraphBuilder();
    const start = builder.onUpdate();
    const setA = builder.setVariable(1, 5);
    const getA = builder.getVariable(1, "a");
    const setB = builder.setVariable(2, { fromKey: "a" });
    builder.connect(start, setA).connect(setA, getA).connect(getA, setB);
    const graph = builder.build();

    const interpretedStore = new VariableStore();
    new VisualScriptComponent({
      graph,
      variableStore: interpretedStore,
    }).update(0.016);

    const compiledStore = new VariableStore();
    new CompiledVisualScriptComponent({
      graph,
      variableStore: compiledStore,
    }).update(0.016);

    expect(compiledStore.getVar(1)).toBe(interpretedStore.getVar(1));
    expect(compiledStore.getVar(2)).toBe(interpretedStore.getVar(2));
    expect(compiledStore.getVar(1)).toBe(5);
    expect(compiledStore.getVar(2)).toBe(5);
  });

  it("compiled branch node takes the same edge as the interpreter, both ways", () => {
    const builder = new VisualScriptGraphBuilder();
    const start = builder.onUpdate();
    const branch = builder.branch(10, "gt", 2);
    const onTrue = builder.setVariable(20, 1);
    const onFalse = builder.setVariable(20, 2);
    builder
      .connect(start, branch)
      .connect(branch, onTrue, 0)
      .connect(branch, onFalse, 1);
    const graph = builder.build();

    for (const actual of [3, 1]) {
      const interpretedStore = new VariableStore();
      interpretedStore.setVar(10, actual);
      new VisualScriptComponent({
        graph,
        variableStore: interpretedStore,
      }).update(0.016);

      const compiledStore = new VariableStore();
      compiledStore.setVar(10, actual);
      new CompiledVisualScriptComponent({
        graph,
        variableStore: compiledStore,
      }).update(0.016);

      expect(compiledStore.getVar(20)).toBe(interpretedStore.getVar(20));
    }
  });

  it("compiled getSwitch/setSwitch matches the interpreter", () => {
    const builder = new VisualScriptGraphBuilder();
    const start = builder.onUpdate();
    const setSw = builder.setSwitch(1, true);
    const getSw = builder.getSwitch(1, "flag");
    const setVar = builder.setVariable(30, { fromKey: "flag" });
    builder.connect(start, setSw).connect(setSw, getSw).connect(getSw, setVar);
    const graph = builder.build();

    const compiledStore = new VariableStore();
    new CompiledVisualScriptComponent({
      graph,
      variableStore: compiledStore,
    }).update(0.016);

    expect(compiledStore.getSwitch(1)).toBe(true);
    expect(compiledStore.getVar(30)).toBe(1);
  });

  it("compiled sendMessage dispatches a real ActorSystem message, same as the interpreter", () => {
    class Recorder extends Actor {
      readonly received: Message[] = [];
      receive(msg: Message): void {
        this.received.push(msg);
      }
    }

    const builder = new VisualScriptGraphBuilder();
    const start = builder.onUpdate();
    const send = builder.sendMessage("target", "ping", { power: 9 });
    builder.connect(start, send);
    const graph = builder.build();

    const interpretedActors = new ActorSystem();
    const interpretedRecorder = new Recorder("target");
    interpretedActors.register(interpretedRecorder);
    new VisualScriptComponent({ graph, actorSystem: interpretedActors }).update(
      0.016,
    );
    interpretedActors.update(0.016);

    const compiledActors = new ActorSystem();
    const compiledRecorder = new Recorder("target");
    compiledActors.register(compiledRecorder);
    new CompiledVisualScriptComponent({
      graph,
      actorSystem: compiledActors,
    }).update(0.016);
    compiledActors.update(0.016);

    expect(compiledRecorder.received).toEqual(interpretedRecorder.received);
    expect(compiledRecorder.received).toHaveLength(1);
    expect(compiledRecorder.received[0]).toMatchObject({
      type: "ping",
      power: 9,
    });
  });

  it("fireEvent only runs matching onEvent chains, same as the interpreter", () => {
    const builder = new VisualScriptGraphBuilder();
    const evtA = builder.onEvent("hit");
    const setA = builder.setVariable(1, 100);
    builder.connect(evtA, setA);
    const evtB = builder.onEvent("heal");
    const setB = builder.setVariable(2, 200);
    builder.connect(evtB, setB);
    const graph = builder.build();

    const store = new VariableStore();
    const compiled = new CompiledVisualScriptComponent({
      graph,
      variableStore: store,
    });
    compiled.fireEvent("hit");

    expect(store.getVar(1)).toBe(100);
    expect(store.getVar(2)).toBe(0);
  });

  it("does not hang on a graph that cycles back into itself", () => {
    const builder = new VisualScriptGraphBuilder();
    const start = builder.onUpdate();
    const seqA = builder.sequence();
    const setA = builder.setVariable(1, { fromKey: "nonexistent" });
    builder.connect(start, seqA);
    builder.connect(seqA, setA);
    builder.connect(setA, seqA);
    const graph = builder.build();

    const store = new VariableStore();
    const compiled = new CompiledVisualScriptComponent({
      graph,
      variableStore: store,
    });

    expect(() => compiled.update(0.016)).not.toThrow();
    expect(store.getVar(1)).toBe(0);
  });

  it("setGraph recompiles instead of reusing the old module", () => {
    const builder = new VisualScriptGraphBuilder();
    const start = builder.onUpdate();
    const setA = builder.setVariable(1, 1);
    builder.connect(start, setA);

    const store = new VariableStore();
    const compiled = new CompiledVisualScriptComponent({
      graph: builder.build(),
      variableStore: store,
    });
    compiled.update(0.016);
    expect(store.getVar(1)).toBe(1);

    const builder2 = new VisualScriptGraphBuilder();
    const start2 = builder2.onUpdate();
    const setA2 = builder2.setVariable(1, 42);
    builder2.connect(start2, setA2);
    compiled.setGraph(builder2.build());
    compiled.update(0.016);
    expect(store.getVar(1)).toBe(42);
  });

  it("has the expected ComponentType key, matching VisualScriptComponent", () => {
    expect(CompiledVisualScriptComponent.TYPE).toBe("VisualScript");
    const compiled = new CompiledVisualScriptComponent({
      graph: { nodes: [], connections: [] },
    });
    expect(compiled.type).toBe("VisualScript");
  });
});

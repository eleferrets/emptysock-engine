import type { Scene } from "../Scene.js";
import type { ActorSystem } from "../ActorSystem.js";
import { VariableStore } from "./VariableStore.js";
import {
  VisualScriptState,
  getVisualScriptGraph,
  getVisualScriptScope,
  type BranchNode,
  type VisualScriptGraph,
  type VSNode,
} from "../components/VisualScript.js";

/**
 * Compiles a `VisualScriptGraph` (the exact JSON shape the Visual Script
 * Editor panel authors) into literal, runnable JavaScript source. Each node
 * becomes its own `case` in a per-trigger dispatch function, and every case
 * body is a specific call against the real public API a hand-written game
 * would use — `ctx.variables.setVar(1, 5)`, `ctx.actorSystem.send("target",
 * { type: "ping", power: 9 })` — with the node's field values baked in as
 * literals at compile time. Nothing in the emitted code re-reads the
 * original `VSNode` objects or dispatches through `node.kind` at runtime;
 * that lookup happens once, here, at compile time.
 *
 * The dispatch loop (a `while` over a `__next` node-id string, driven by a
 * `switch`) exists only because a `VisualScriptGraph` can legally contain
 * cycles (see `visual-script.test.ts`'s destroy/scope-clearing case, and the
 * step-limit guard below) — straight-line code cannot represent a cycle.
 * This is not "stringifying an interpreter": every case is the specific
 * compiled statement for that one node, not a generic `execute(node)` call.
 */
const MAX_STEPS_PER_TICK = 10_000;

export interface VSCompiledContext {
  variables: VariableStore;
  actorSystem: ActorSystem | null;
  /** Per-trigger-run evaluation scope, cleared before each onUpdate/onEvent chain. */
  scope: Map<string, number>;
}

interface CompiledModule {
  run(ctx: VSCompiledContext): void;
  fireEvent(eventType: string, ctx: VSCompiledContext): void;
}

function jsStringLiteral(value: string): string {
  return JSON.stringify(value);
}

function comparatorOperator(comparator: BranchNode["comparator"]): string {
  switch (comparator) {
    case "eq":
      return "===";
    case "neq":
      return "!==";
    case "gt":
      return ">";
    case "lt":
      return "<";
    case "gte":
      return ">=";
    case "lte":
      return "<=";
  }
}

function emitCase(node: VSNode): string {
  const id = jsStringLiteral(node.id);
  switch (node.kind) {
    case "onUpdate":
    case "onEvent":
    case "sequence":
      return `      case ${id}: {\n        __next = ${node.next[0] === undefined ? "undefined" : jsStringLiteral(node.next[0])};\n        break;\n      }`;

    case "branch": {
      const trueNext =
        node.next[0] === undefined
          ? "undefined"
          : jsStringLiteral(node.next[0]);
      const falseNext =
        node.next[1] === undefined
          ? "undefined"
          : jsStringLiteral(node.next[1]);
      return `      case ${id}: {
        const __actual = ctx.variables.getVar(${node.variableIndex});
        if (__actual ${comparatorOperator(node.comparator)} ${node.value}) {
          __next = ${trueNext};
        } else {
          __next = ${falseNext};
        }
        break;
      }`;
    }

    case "getVariable":
      return `      case ${id}: {
        ctx.scope.set(${jsStringLiteral(node.outputKey)}, ctx.variables.getVar(${node.variableIndex}));
        __next = ${node.next[0] === undefined ? "undefined" : jsStringLiteral(node.next[0])};
        break;
      }`;

    case "setVariable": {
      const valueExpr =
        typeof node.value === "number"
          ? String(node.value)
          : `(ctx.scope.get(${jsStringLiteral(node.value.fromKey)}) ?? 0)`;
      return `      case ${id}: {
        ctx.variables.setVar(${node.variableIndex}, ${valueExpr});
        __next = ${node.next[0] === undefined ? "undefined" : jsStringLiteral(node.next[0])};
        break;
      }`;
    }

    case "getSwitch":
      return `      case ${id}: {
        ctx.scope.set(${jsStringLiteral(node.outputKey)}, ctx.variables.getSwitch(${node.switchIndex}) ? 1 : 0);
        __next = ${node.next[0] === undefined ? "undefined" : jsStringLiteral(node.next[0])};
        break;
      }`;

    case "setSwitch":
      return `      case ${id}: {
        ctx.variables.setSwitch(${node.switchIndex}, ${node.value});
        __next = ${node.next[0] === undefined ? "undefined" : jsStringLiteral(node.next[0])};
        break;
      }`;

    case "sendMessage": {
      const payloadEntries = Object.entries(node.payload ?? {})
        .map(([k, v]) => `${jsStringLiteral(k)}: ${JSON.stringify(v)}`)
        .join(", ");
      return `      case ${id}: {
        if (ctx.actorSystem !== null) {
          ctx.actorSystem.send(${jsStringLiteral(node.targetActorId)}, { type: ${jsStringLiteral(node.messageType)}${payloadEntries ? `, ${payloadEntries}` : ""} });
        }
        __next = ${node.next[0] === undefined ? "undefined" : jsStringLiteral(node.next[0])};
        break;
      }`;
    }
  }
}

/** Every node reachable from `startId` by following `next[]`, cycle-safe. */
function reachableFrom(startId: string, byId: Map<string, VSNode>): VSNode[] {
  const seen = new Set<string>();
  const order: VSNode[] = [];
  const stack = [startId];
  while (stack.length > 0) {
    const id = stack.pop();
    if (id === undefined || seen.has(id)) continue;
    seen.add(id);
    const node = byId.get(id);
    if (node === undefined) continue;
    order.push(node);
    for (const next of node.next) {
      // node.next may be sparse (a branch node with only one wired port), so
      // this can still be undefined at runtime despite the string[] type.
      stack.push(next);
    }
  }
  return order;
}

function emitRunner(
  fnName: string,
  startId: string,
  byId: Map<string, VSNode>,
): string {
  const nodes = reachableFrom(startId, byId);
  const cases = nodes.map(emitCase).join("\n");
  return `function ${fnName}(ctx) {
  let __next = ${jsStringLiteral(startId)};
  let __steps = 0;
  while (__next !== undefined) {
    if (__steps++ >= ${MAX_STEPS_PER_TICK}) {
      console.warn("[VisualScriptSystem] step limit exceeded — graph likely cycles into itself");
      return;
    }
    switch (__next) {
${cases}
      default:
        return;
    }
  }
}`;
}

/**
 * Compiles a `VisualScriptGraph` to a self-contained CommonJS-style module
 * source string exporting `run(ctx)` (drives every onUpdate chain) and
 * `fireEvent(eventType, ctx)` (drives every matching onEvent chain).
 */
export function compileVisualScriptGraph(graph: VisualScriptGraph): string {
  const byId = new Map(graph.nodes.map((n) => [n.id, n] as const));

  const updateNodes = graph.nodes.filter((n) => n.kind === "onUpdate");
  const eventNodes = graph.nodes.filter((n) => n.kind === "onEvent");

  const runnerDecls: string[] = [];
  const updateCalls: string[] = [];
  for (const [i, node] of updateNodes.entries()) {
    if (node.next[0] === undefined) continue;
    const fnName = `__runOnUpdate${i}`;
    runnerDecls.push(emitRunner(fnName, node.next[0], byId));
    updateCalls.push(`  ctx.scope.clear();\n  ${fnName}(ctx);`);
  }

  const eventBranches: string[] = [];
  for (const [i, node] of eventNodes.entries()) {
    if (node.next[0] === undefined) continue;
    const fnName = `__runOnEvent${i}`;
    runnerDecls.push(emitRunner(fnName, node.next[0], byId));
    eventBranches.push(
      `  if (eventType === ${jsStringLiteral(node.eventType)}) {\n    ctx.scope.clear();\n    ${fnName}(ctx);\n  }`,
    );
  }

  return `"use strict";
// Compiled from a VisualScriptGraph — see VisualScriptSystem.ts. Do not hand-edit;
// regenerate from the source graph instead.

${runnerDecls.join("\n\n")}

function run(ctx) {
${updateCalls.join("\n") || "  void ctx;"}
}

function fireEvent(eventType, ctx) {
${eventBranches.join("\n") || "  void eventType;\n  void ctx;"}
}

module.exports = { run, fireEvent };
`;
}

function loadCompiledModule(source: string): CompiledModule {
  const factory = new Function("module", "exports", "console", source);
  const module: { exports: CompiledModule } = { exports: {} as CompiledModule };
  factory(module, module.exports, console);
  return module.exports;
}

/**
 * ECS-side driver for `VisualScriptState` entities. Takes a shared
 * `VariableStore`/`ActorSystem` once, at construction, matching
 * `SceneLifecycle`'s "one `VariableStore`/`ActorSystem` per scene, shared by
 * whatever reads it" convention (CLAUDE.md's "VNSystem and MapEventSystem
 * default to an isolated VariableStore" entry) — pass `ctx.variables`/
 * `ctx.actors` from a scene's `onLoad` to share state with the rest of the
 * game, or leave the defaults for an isolated instance.
 *
 * Graphs are compiled once per distinct `graphId` and cached for the
 * system's lifetime; many entities sharing one `graphId` share one compiled
 * module, never duplicating the compiled function per entity.
 */
export class VisualScriptSystem {
  private readonly _variables: VariableStore;
  private readonly _actorSystem: ActorSystem | null;
  private readonly _compiled = new Map<string, CompiledModule>();

  constructor(options?: {
    variables?: VariableStore;
    actorSystem?: ActorSystem;
  }) {
    this._variables = options?.variables ?? new VariableStore();
    this._actorSystem = options?.actorSystem ?? null;
  }

  private compiledFor(graphId: string): CompiledModule | undefined {
    let compiled = this._compiled.get(graphId);
    if (compiled !== undefined) return compiled;

    const graph = getVisualScriptGraph(graphId);
    if (graph === undefined) return undefined;

    compiled = loadCompiledModule(compileVisualScriptGraph(graph));
    this._compiled.set(graphId, compiled);
    return compiled;
  }

  /** Invalidates a cached compiled module, e.g. after re-registering `graphId` with new graph data. */
  invalidate(graphId: string): void {
    this._compiled.delete(graphId);
  }

  /** Runs every `VisualScriptState` entity's onUpdate chain(s) once. */
  update(scene: Scene): void {
    scene.each(VisualScriptState, (state, entity) => {
      const compiled = this.compiledFor(state.graphId);
      if (compiled === undefined) return;
      const scope = getVisualScriptScope(scene.world, entity.eid);
      scope.clear();
      compiled.run({
        variables: this._variables,
        actorSystem: this._actorSystem,
        scope,
      });
    });
  }

  /** Fires `eventType` against every `VisualScriptState` entity's matching onEvent chain(s). */
  fireEvent(scene: Scene, eventType: string): void {
    scene.each(VisualScriptState, (state, entity) => {
      const compiled = this.compiledFor(state.graphId);
      if (compiled === undefined) return;
      const scope = getVisualScriptScope(scene.world, entity.eid);
      scope.clear();
      compiled.fireEvent(eventType, {
        variables: this._variables,
        actorSystem: this._actorSystem,
        scope,
      });
    });
  }

  get variables(): VariableStore {
    return this._variables;
  }
}

import type { ActorSystem } from "../core/ActorSystem.js";
import { Component } from "../core/Component.js";
import type {
  BranchNode,
  VisualScriptGraph,
  VSNode,
} from "../components/VisualScriptComponent.js";
import { VariableStore } from "./VariableStore.js";

/**
 * Compiles a VisualScriptGraph (the exact JSON shape the Visual Script
 * Editor panel authors and VisualScriptComponent interprets — see
 * CLAUDE.md's "Visual scripting" entry for why this format, not a new one,
 * is the compile target) into literal, runnable JavaScript source.
 *
 * Each node becomes its own `case` in a per-trigger dispatch function, and
 * every case body is a specific call against the real public API a
 * hand-written game would use — `ctx.variables.setVar(1, 5)`,
 * `ctx.actorSystem.send("target", { type: "ping", power: 9 })` — with the
 * node's field values baked in as literals at compile time. Nothing in the
 * emitted code re-reads the original VSNode objects or dispatches through
 * `node.kind` at runtime; that lookup happens once, here, at compile time.
 *
 * The dispatch loop (a `while` over a `__next` node-id string, driven by a
 * `switch`) exists only because a VisualScriptGraph can legally contain
 * cycles (see VisualScriptComponent.test.ts's "does not loop forever" case)
 * — straight-line code cannot represent a cycle. This is not "stringifying
 * the interpreter": every case is the specific compiled statement for that
 * one node, not a generic `execute(node)` call, and the loop carries the
 * same MAX_STEPS_PER_TICK-style guard as the interpreter for the same
 * documented reason (CLAUDE.md's "Actor mailbox ordering" cousin: a graph
 * that always re-enqueues itself must not hang the process).
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
      console.warn("[CompiledVisualScript] step limit exceeded — graph likely cycles into itself");
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
 * Compiles a VisualScriptGraph to a self-contained CommonJS-style module
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
// Compiled from a VisualScriptGraph — see VisualScriptCompiler.ts. Do not hand-edit;
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

/** Loads a module string produced by compileVisualScriptGraph and returns its exports. */
function loadCompiledModule(source: string): CompiledModule {
  const factory = new Function("module", "exports", "console", source);
  const module: { exports: CompiledModule } = { exports: {} as CompiledModule };
  factory(module, module.exports, console);
  return module.exports;
}

/**
 * Drop-in replacement for VisualScriptComponent that runs *compiled* code
 * instead of interpreting the graph node-by-node every frame. Same public
 * shape (graph/setGraph/setActorSystem/variableStore/update/fireEvent/
 * serialize) so it can be substituted anywhere a VisualScriptComponent is
 * used. VisualScriptComponent itself is unchanged and still the default —
 * see CLAUDE.md for why both exist.
 */
export class CompiledVisualScriptComponent extends Component {
  static readonly TYPE = "VisualScript";

  private _graph: VisualScriptGraph;
  private _variableStore: VariableStore;
  private _actorSystem: ActorSystem | null;
  private _scope: Map<string, number> = new Map();
  private _compiled: CompiledModule;
  private _source: string;

  constructor(options: {
    graph: VisualScriptGraph;
    variableStore?: VariableStore;
    actorSystem?: ActorSystem;
  }) {
    super(CompiledVisualScriptComponent.TYPE);
    this._graph = options.graph;
    this._variableStore = options.variableStore ?? new VariableStore();
    this._actorSystem = options.actorSystem ?? null;
    this._source = compileVisualScriptGraph(this._graph);
    this._compiled = loadCompiledModule(this._source);
  }

  get graph(): VisualScriptGraph {
    return this._graph;
  }

  /** The generated JavaScript source currently backing this component. */
  get compiledSource(): string {
    return this._source;
  }

  setGraph(graph: VisualScriptGraph): void {
    this._graph = graph;
    this._source = compileVisualScriptGraph(graph);
    this._compiled = loadCompiledModule(this._source);
  }

  setActorSystem(actorSystem: ActorSystem): void {
    this._actorSystem = actorSystem;
  }

  get variableStore(): VariableStore {
    return this._variableStore;
  }

  private context(): VSCompiledContext {
    return {
      variables: this._variableStore,
      actorSystem: this._actorSystem,
      scope: this._scope,
    };
  }

  override update(_deltaTime: number): void {
    this._compiled.run(this.context());
  }

  fireEvent(eventType: string): void {
    this._compiled.fireEvent(eventType, this.context());
  }

  override serialize(): Record<string, unknown> {
    return {
      ...super.serialize(),
      graph: this._graph,
    };
  }
}

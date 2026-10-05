import type { World } from "bitecs";
/**
 * Node graph shape produced by the Visual Script Editor panel, and equally
 * constructible by hand in game code (see `VisualScriptGraphBuilder` below).
 * This is the single source of truth for what a graph "is" — the panel and
 * `VisualScriptSystem`'s compiler both serialize/consume exactly this shape.
 */
export type VSNodeKind =
  | "onUpdate"
  | "onEvent"
  | "sequence"
  | "branch"
  | "getVariable"
  | "setVariable"
  | "getSwitch"
  | "setSwitch"
  | "sendMessage";
interface VSNodeBase {
  id: string;
  kind: VSNodeKind;
  /** Node ids wired to this node's execution output(s), in port order. */
  next: string[];
}
export interface OnUpdateNode extends VSNodeBase {
  kind: "onUpdate";
}
export interface OnEventNode extends VSNodeBase {
  kind: "onEvent";
  eventType: string;
}
export interface SequenceNode extends VSNodeBase {
  kind: "sequence";
}
export interface BranchNode extends VSNodeBase {
  kind: "branch";
  /** Variable index (VariableStore) compared against `value`. */
  variableIndex: number;
  comparator: "eq" | "neq" | "gt" | "lt" | "gte" | "lte";
  value: number;
}
export interface GetVariableNode extends VSNodeBase {
  kind: "getVariable";
  variableIndex: number;
  /** Result is written into this evaluation-scope key for downstream nodes. */
  outputKey: string;
}
export interface SetVariableNode extends VSNodeBase {
  kind: "setVariable";
  variableIndex: number;
  /** Literal value, or an evaluation-scope key produced by an earlier getVariable node. */
  value:
    | number
    | {
        fromKey: string;
      };
}
export interface GetSwitchNode extends VSNodeBase {
  kind: "getSwitch";
  switchIndex: number;
  outputKey: string;
}
export interface SetSwitchNode extends VSNodeBase {
  kind: "setSwitch";
  switchIndex: number;
  value: boolean;
}
export interface SendMessageNode extends VSNodeBase {
  kind: "sendMessage";
  targetActorId: string;
  messageType: string;
  /** Extra fields merged into the outgoing Message. */
  payload?: Record<string, unknown>;
}
export type VSNode =
  | OnUpdateNode
  | OnEventNode
  | SequenceNode
  | BranchNode
  | GetVariableNode
  | SetVariableNode
  | GetSwitchNode
  | SetSwitchNode
  | SendMessageNode;
export interface VSConnection {
  id: string;
  from: string;
  to: string;
  /** Output port index on `from` this connection carries (default 0). */
  fromPort?: number;
}
export interface VisualScriptGraph {
  nodes: VSNode[];
  connections: VSConnection[];
}
/**
 * Fluent, code-first builder that produces the exact `VisualScriptGraph`
 * shape the panel authors and round-trips. Lets a developer hand-write a
 * graph instead of drawing it.
 */
export declare class VisualScriptGraphBuilder {
  private readonly _nodes;
  private readonly _connections;
  private _idCounter;
  private nextId;
  private add;
  onUpdate(id?: string): OnUpdateNode;
  onEvent(eventType: string, id?: string): OnEventNode;
  sequence(id?: string): SequenceNode;
  branch(
    variableIndex: number,
    comparator: BranchNode["comparator"],
    value: number,
    id?: string,
  ): BranchNode;
  getVariable(
    variableIndex: number,
    outputKey: string,
    id?: string,
  ): GetVariableNode;
  setVariable(
    variableIndex: number,
    value:
      | number
      | {
          fromKey: string;
        },
    id?: string,
  ): SetVariableNode;
  getSwitch(switchIndex: number, outputKey: string, id?: string): GetSwitchNode;
  setSwitch(switchIndex: number, value: boolean, id?: string): SetSwitchNode;
  sendMessage(
    targetActorId: string,
    messageType: string,
    payload?: Record<string, unknown>,
    id?: string,
  ): SendMessageNode;
  /** Wire `from`'s execution output (port 0, or the true/false branch port for BranchNode) to `to`. */
  connect(from: VSNode, to: VSNode, fromPort?: number): this;
  build(): VisualScriptGraph;
}
/**
 * `VisualScriptState` is
 * defined via `defineComponent`'s `SerializableRecord` constraint, which
 * rules out storing the graph itself (nodes/connections, functions and all)
 * directly on the component.
 *
 * Per the research that informed this design (production ECS engines —
 * Unity DOTS's `EntitiesBT`/`DOTS-BehaviorTree`, Bevy's `bevy_behavior` —
 * all converge on the same shape): the graph itself is treated as shared,
 * immutable data, not per-entity component state. Two entities running the
 * same authored graph reference the same `graphId`, never a duplicated copy
 * of `nodes`/`connections` sitting in bitECS's own parallel arrays (which
 * would also violate `Serializable`'s "no functions, no arbitrary nested
 * object graphs" spirit for anything non-trivial). `VisualScriptState` is
 * intentionally the small per-entity part only: which graph this entity is
 * running. `registerVisualScriptGraph`/`getVisualScriptGraph` hold the
 * actual graph data in a plain module-level registry, the same "shared
 * static data keyed by id" pattern `@emptysock/network`'s `NetworkedFields`
 * side-map and `TilemapSystem`'s tilemap registry both already use.
 */
export declare const VisualScriptState: import("../Component.js").ComponentDef<{
  graphId: string;
}>;
/** Registers (or replaces) the graph data referenced by `graphId`. */
export declare function registerVisualScriptGraph(
  graphId: string,
  graph: VisualScriptGraph,
): void;
export declare function getVisualScriptGraph(
  graphId: string,
): VisualScriptGraph | undefined;
export declare function unregisterVisualScriptGraph(graphId: string): void;
export declare function getVisualScriptScope(
  world: World,
  eid: number,
): Map<string, number>;
/**
 * Called from `Scene.destroy()` for every destroyed entity, mirroring
 * `clearPhysicsBody` — a pooled entity's reused bitECS id must not inherit
 * the previous occupant's stale scope entries (see CLAUDE.md's "Shared
 * internal helpers" entry for why this can't just wait on `WeakMap` GC).
 */
export declare function clearVisualScriptScope(world: World, eid: number): void;
export {};

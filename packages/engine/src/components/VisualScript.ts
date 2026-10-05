import type { World } from "bitecs";
import { defineComponent } from "../Component.js";
import { getOrCreate, getOrCreateMapEntry } from "../internal/scoped.js";

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
  /** next[0] = true branch, next[1] = false branch. Either may be omitted. */
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
  value: number | { fromKey: string };
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
export class VisualScriptGraphBuilder {
  private readonly _nodes = new Map<string, VSNode>();
  private readonly _connections: VSConnection[] = [];
  private _idCounter = 0;

  private nextId(prefix: string): string {
    this._idCounter += 1;
    return `${prefix}-${this._idCounter}`;
  }

  private add<T extends VSNode>(node: Omit<T, "next">): T {
    const full = { ...node, next: [] } as unknown as T;
    this._nodes.set(full.id, full);
    return full;
  }

  onUpdate(id = this.nextId("onUpdate")): OnUpdateNode {
    return this.add<OnUpdateNode>({ id, kind: "onUpdate" });
  }

  onEvent(eventType: string, id = this.nextId("onEvent")): OnEventNode {
    return this.add<OnEventNode>({ id, kind: "onEvent", eventType });
  }

  sequence(id = this.nextId("sequence")): SequenceNode {
    return this.add<SequenceNode>({ id, kind: "sequence" });
  }

  branch(
    variableIndex: number,
    comparator: BranchNode["comparator"],
    value: number,
    id = this.nextId("branch"),
  ): BranchNode {
    return this.add<BranchNode>({
      id,
      kind: "branch",
      variableIndex,
      comparator,
      value,
    });
  }

  getVariable(
    variableIndex: number,
    outputKey: string,
    id = this.nextId("getVariable"),
  ): GetVariableNode {
    return this.add<GetVariableNode>({
      id,
      kind: "getVariable",
      variableIndex,
      outputKey,
    });
  }

  setVariable(
    variableIndex: number,
    value: number | { fromKey: string },
    id = this.nextId("setVariable"),
  ): SetVariableNode {
    return this.add<SetVariableNode>({
      id,
      kind: "setVariable",
      variableIndex,
      value,
    });
  }

  getSwitch(
    switchIndex: number,
    outputKey: string,
    id = this.nextId("getSwitch"),
  ): GetSwitchNode {
    return this.add<GetSwitchNode>({
      id,
      kind: "getSwitch",
      switchIndex,
      outputKey,
    });
  }

  setSwitch(
    switchIndex: number,
    value: boolean,
    id = this.nextId("setSwitch"),
  ): SetSwitchNode {
    return this.add<SetSwitchNode>({
      id,
      kind: "setSwitch",
      switchIndex,
      value,
    });
  }

  sendMessage(
    targetActorId: string,
    messageType: string,
    payload?: Record<string, unknown>,
    id = this.nextId("sendMessage"),
  ): SendMessageNode {
    const base: Omit<SendMessageNode, "next"> = {
      id,
      kind: "sendMessage",
      targetActorId,
      messageType,
      ...(payload !== undefined ? { payload } : {}),
    };
    return this.add<SendMessageNode>(base);
  }

  /** Wire `from`'s execution output (port 0, or the true/false branch port for BranchNode) to `to`. */
  connect(from: VSNode, to: VSNode, fromPort = 0): this {
    const id = this.nextId("conn");
    this._connections.push({ id, from: from.id, to: to.id, fromPort });
    from.next[fromPort] = to.id;
    return this;
  }

  build(): VisualScriptGraph {
    return {
      nodes: [...this._nodes.values()],
      connections: [...this._connections],
    };
  }
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
export const VisualScriptState = defineComponent(
  "VisualScriptState",
  () => ({
    graphId: "",
  }),
  {
    schema: {
      graphId: { kind: "string" },
    },
  },
);

const graphRegistry = new Map<string, VisualScriptGraph>();

/** Registers (or replaces) the graph data referenced by `graphId`. */
export function registerVisualScriptGraph(
  graphId: string,
  graph: VisualScriptGraph,
): void {
  graphRegistry.set(graphId, graph);
}

export function getVisualScriptGraph(
  graphId: string,
): VisualScriptGraph | undefined {
  return graphRegistry.get(graphId);
}

export function unregisterVisualScriptGraph(graphId: string): void {
  graphRegistry.delete(graphId);
}

/**
 * Per-entity evaluation scope (a graph run's transient
 * outputKey -> number bindings — see `VisualScriptComponent`'s `_scope`).
 * This is genuinely per-entity, mutable, non-serializable runtime state, so
 * it lives in a side-table scoped by `World` + eid — the same shape
 * `PhysicsBody`'s callback side-table uses — rather than on the component
 * itself, which must stay `Serializable`.
 */
const scopesByWorld = new WeakMap<World, Map<number, Map<string, number>>>();

export function getVisualScriptScope(
  world: World,
  eid: number,
): Map<string, number> {
  const scopes = getOrCreate(scopesByWorld, world, () => new Map());
  return getOrCreateMapEntry(scopes, eid, () => new Map());
}

/**
 * Called from `Scene.destroy()` for every destroyed entity, mirroring
 * `clearPhysicsBody` — a pooled entity's reused bitECS id must not inherit
 * the previous occupant's stale scope entries (see CLAUDE.md's "Shared
 * internal helpers" entry for why this can't just wait on `WeakMap` GC).
 */
export function clearVisualScriptScope(world: World, eid: number): void {
  scopesByWorld.get(world)?.delete(eid);
}

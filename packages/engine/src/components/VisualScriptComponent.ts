import { Component } from "../core/Component.js";
import type { ActorSystem } from "../core/ActorSystem.js";
import type { Message } from "../core/Actor.js";
import { VariableStore } from "../systems/VariableStore.js";

/**
 * Node graph shape produced by the Visual Script Editor panel, and equally
 * constructible by hand in game code (see VisualScriptGraphBuilder below).
 * This is the single source of truth for what a graph "is" — the panel and
 * the interpreter both serialize/consume exactly this shape.
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
 * Fluent, code-first builder that produces the exact VisualScriptGraph shape
 * the panel authors and round-trips. Lets a developer hand-write a graph
 * instead of drawing it.
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

const MAX_STEPS_PER_TICK = 10_000;

/**
 * Per-entity component that holds a serialized VisualScriptGraph and
 * interprets it. Registered under ComponentType "VisualScript" like any
 * other Component — addComponent/getComponent key off that string.
 *
 * Execution model:
 * - onUpdate nodes fire once every update() call (every frame).
 * - onEvent nodes fire when fireEvent(eventType) is called.
 * - From a trigger node, execution walks `next` edges synchronously,
 *   following sequence/branch/data/action nodes until it reaches a node
 *   with no outgoing edge for the taken port, or MAX_STEPS_PER_TICK is hit
 *   (a defensive cap against a graph that cycles back into itself, mirroring
 *   the ActorSystem mailbox-drain guidance in CLAUDE.md).
 */
export class VisualScriptComponent extends Component {
  static readonly TYPE = "VisualScript";

  private _graph: VisualScriptGraph;
  private _variableStore: VariableStore;
  private _actorSystem: ActorSystem | null;
  private _scope: Map<string, number> = new Map();

  constructor(options: {
    graph: VisualScriptGraph;
    variableStore?: VariableStore;
    actorSystem?: ActorSystem;
  }) {
    super(VisualScriptComponent.TYPE);
    this._graph = options.graph;
    this._variableStore = options.variableStore ?? new VariableStore();
    this._actorSystem = options.actorSystem ?? null;
  }

  get graph(): VisualScriptGraph {
    return this._graph;
  }

  setGraph(graph: VisualScriptGraph): void {
    this._graph = graph;
  }

  setActorSystem(actorSystem: ActorSystem): void {
    this._actorSystem = actorSystem;
  }

  get variableStore(): VariableStore {
    return this._variableStore;
  }

  override update(_deltaTime: number): void {
    for (const node of this._graph.nodes) {
      if (node.kind === "onUpdate") {
        this._scope.clear();
        this.runFrom(node.next[0]);
      }
    }
  }

  /** Fire every onEvent node whose eventType matches. */
  fireEvent(eventType: string): void {
    for (const node of this._graph.nodes) {
      if (node.kind === "onEvent" && node.eventType === eventType) {
        this._scope.clear();
        this.runFrom(node.next[0]);
      }
    }
  }

  private nodeById(id: string | undefined): VSNode | undefined {
    if (id === undefined) return undefined;
    return this._graph.nodes.find((n) => n.id === id);
  }

  private runFrom(startId: string | undefined): void {
    let currentId = startId;
    let steps = 0;

    while (currentId !== undefined) {
      if (steps >= MAX_STEPS_PER_TICK) {
        console.warn(
          "[VisualScriptComponent] step limit exceeded — graph likely cycles into itself",
        );
        return;
      }
      steps += 1;

      const node = this.nodeById(currentId);
      if (node === undefined) return;

      currentId = this.execute(node);
    }
  }

  /** Executes one node and returns the id of the next node to run, if any. */
  private execute(node: VSNode): string | undefined {
    switch (node.kind) {
      case "onUpdate":
      case "onEvent":
      case "sequence":
        return node.next[0];

      case "branch": {
        const actual = this._variableStore.getVar(node.variableIndex);
        const taken = compare(actual, node.comparator, node.value);
        return taken ? node.next[0] : node.next[1];
      }

      case "getVariable": {
        const value = this._variableStore.getVar(node.variableIndex);
        this._scope.set(node.outputKey, value);
        return node.next[0];
      }

      case "setVariable": {
        const value =
          typeof node.value === "number"
            ? node.value
            : (this._scope.get(node.value.fromKey) ?? 0);
        this._variableStore.setVar(node.variableIndex, value);
        return node.next[0];
      }

      case "getSwitch": {
        const value = this._variableStore.getSwitch(node.switchIndex) ? 1 : 0;
        this._scope.set(node.outputKey, value);
        return node.next[0];
      }

      case "setSwitch": {
        this._variableStore.setSwitch(node.switchIndex, node.value);
        return node.next[0];
      }

      case "sendMessage": {
        if (this._actorSystem !== null) {
          const msg: Message = {
            type: node.messageType,
            ...(node.payload ?? {}),
          };
          this._actorSystem.send(node.targetActorId, msg);
        }
        return node.next[0];
      }
    }
  }

  override serialize(): Record<string, unknown> {
    return {
      ...super.serialize(),
      graph: this._graph,
    };
  }
}

function compare(
  actual: number,
  comparator: BranchNode["comparator"],
  expected: number,
): boolean {
  switch (comparator) {
    case "eq":
      return actual === expected;
    case "neq":
      return actual !== expected;
    case "gt":
      return actual > expected;
    case "lt":
      return actual < expected;
    case "gte":
      return actual >= expected;
    case "lte":
      return actual <= expected;
  }
}

import { Component } from "../core/Component.js";
import type { ActorSystem } from "../core/ActorSystem.js";
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
 * Fluent, code-first builder that produces the exact VisualScriptGraph shape
 * the panel authors and round-trips. Lets a developer hand-write a graph
 * instead of drawing it.
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
export declare class VisualScriptComponent extends Component {
  static readonly TYPE = "VisualScript";
  private _graph;
  private _variableStore;
  private _actorSystem;
  private _scope;
  constructor(options: {
    graph: VisualScriptGraph;
    variableStore?: VariableStore;
    actorSystem?: ActorSystem;
  });
  get graph(): VisualScriptGraph;
  setGraph(graph: VisualScriptGraph): void;
  setActorSystem(actorSystem: ActorSystem): void;
  get variableStore(): VariableStore;
  update(_deltaTime: number): void;
  /** Fire every onEvent node whose eventType matches. */
  fireEvent(eventType: string): void;
  private nodeById;
  private runFrom;
  /** Executes one node and returns the id of the next node to run, if any. */
  private execute;
  serialize(): Record<string, unknown>;
}
export {};

import type { ActorSystem } from "../core/ActorSystem.js";
import { Component } from "../core/Component.js";
import type { VisualScriptGraph } from "../components/VisualScriptComponent.js";
import { VariableStore } from "./VariableStore.js";
export interface VSCompiledContext {
  variables: VariableStore;
  actorSystem: ActorSystem | null;
  /** Per-trigger-run evaluation scope, cleared before each onUpdate/onEvent chain. */
  scope: Map<string, number>;
}
/**
 * Compiles a VisualScriptGraph to a self-contained CommonJS-style module
 * source string exporting `run(ctx)` (drives every onUpdate chain) and
 * `fireEvent(eventType, ctx)` (drives every matching onEvent chain).
 */
export declare function compileVisualScriptGraph(
  graph: VisualScriptGraph,
): string;
/**
 * Drop-in replacement for VisualScriptComponent that runs *compiled* code
 * instead of interpreting the graph node-by-node every frame. Same public
 * shape (graph/setGraph/setActorSystem/variableStore/update/fireEvent/
 * serialize) so it can be substituted anywhere a VisualScriptComponent is
 * used. VisualScriptComponent itself is unchanged and still the default —
 * see CLAUDE.md for why both exist.
 */
export declare class CompiledVisualScriptComponent extends Component {
  static readonly TYPE = "VisualScript";
  private _graph;
  private _variableStore;
  private _actorSystem;
  private _scope;
  private _compiled;
  private _source;
  constructor(options: {
    graph: VisualScriptGraph;
    variableStore?: VariableStore;
    actorSystem?: ActorSystem;
  });
  get graph(): VisualScriptGraph;
  /** The generated JavaScript source currently backing this component. */
  get compiledSource(): string;
  setGraph(graph: VisualScriptGraph): void;
  setActorSystem(actorSystem: ActorSystem): void;
  get variableStore(): VariableStore;
  private context;
  update(_deltaTime: number): void;
  fireEvent(eventType: string): void;
  serialize(): Record<string, unknown>;
}

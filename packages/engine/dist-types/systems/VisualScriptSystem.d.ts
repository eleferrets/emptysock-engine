import type { Scene } from "../Scene.js";
import type { ActorSystem } from "../ActorSystem.js";
import { VariableStore } from "./VariableStore.js";
import { type VisualScriptGraph } from "../components/VisualScript.js";
export interface VSCompiledContext {
  variables: VariableStore;
  actorSystem: ActorSystem | null;
  /** Per-trigger-run evaluation scope, cleared before each onUpdate/onEvent chain. */
  scope: Map<string, number>;
}
/**
 * Compiles a `VisualScriptGraph` to a self-contained CommonJS-style module
 * source string exporting `run(ctx)` (drives every onUpdate chain) and
 * `fireEvent(eventType, ctx)` (drives every matching onEvent chain).
 */
export declare function compileVisualScriptGraph(
  graph: VisualScriptGraph,
): string;
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
export declare class VisualScriptSystem {
  private readonly _variables;
  private readonly _actorSystem;
  private readonly _compiled;
  constructor(options?: {
    variables?: VariableStore;
    actorSystem?: ActorSystem;
  });
  private compiledFor;
  /** Invalidates a cached compiled module, e.g. after re-registering `graphId` with new graph data. */
  invalidate(graphId: string): void;
  /** Runs every `VisualScriptState` entity's onUpdate chain(s) once. */
  update(scene: Scene): void;
  /** Fires `eventType` against every `VisualScriptState` entity's matching onEvent chain(s). */
  fireEvent(scene: Scene, eventType: string): void;
  get variables(): VariableStore;
}
//# sourceMappingURL=VisualScriptSystem.d.ts.map

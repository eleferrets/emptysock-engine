import type { Scene } from "../Scene.js";
import type { ActorSystem } from "../../core/ActorSystem.js";
import { VariableStore } from "../../systems/VariableStore.js";
/**
 * ECS-side driver for `VisualScriptState` entities. Unlike the classic
 * `VisualScriptComponent`/`CompiledVisualScriptComponent` (which each own a
 * private `VariableStore`/`ActorSystem` reference per component instance),
 * this system takes both once, at construction, matching `SceneLifecycle`'s
 * existing "one `VariableStore`/`ActorSystem` per scene, shared by whatever
 * reads it" convention (CLAUDE.md's "VNSystem and MapEventSystem default to
 * an isolated VariableStore" entry) — pass `ctx.variables`/`ctx.actors` from
 * a scene's `onLoad` to share state with the rest of the game, or leave the
 * defaults for an isolated instance.
 *
 * Graphs are compiled once per distinct `graphId` (via the same
 * `compileVisualScriptGraph` the classic `CompiledVisualScriptComponent`
 * uses — it has zero classic-`Component` coupling, so it's reused as-is
 * rather than re-implemented) and cached for the system's lifetime; many
 * entities sharing one `graphId` share one compiled module, never
 * duplicating the compiled function per entity.
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

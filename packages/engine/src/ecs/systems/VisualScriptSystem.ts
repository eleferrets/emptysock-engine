import type { Scene } from "../Scene.js";
import type { ActorSystem } from "../../core/ActorSystem.js";
import { VariableStore } from "../../systems/VariableStore.js";
import {
  compileVisualScriptGraph,
  type VSCompiledContext,
} from "../../systems/VisualScriptCompiler.js";
import {
  VisualScriptState,
  getVisualScriptGraph,
  getVisualScriptScope,
} from "../components/VisualScript.js";

interface CompiledModule {
  run(ctx: VSCompiledContext): void;
  fireEvent(eventType: string, ctx: VSCompiledContext): void;
}

function loadCompiledModule(source: string): CompiledModule {
  const factory = new Function("module", "exports", "console", source);
  const module: { exports: CompiledModule } = { exports: {} as CompiledModule };
  factory(module, module.exports, console);
  return module.exports;
}

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

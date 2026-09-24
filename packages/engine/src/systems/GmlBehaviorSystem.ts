import type { Entity } from "../Entity.js";
import type { Scene } from "../Scene.js";
import type { GmlActionContext } from "../compat/gmlActions.js";
import type { GmlDrawTarget } from "../compat/gml.js";
import {
  GmlBehaviorState,
  getGmlBehavior,
  type GmlBehaviorModule,
} from "../components/GmlBehavior.js";

/**
 * Real, automatic dispatch for GMS2-imported `.behavior.ts` modules — the
 * gap CLAUDE.md's "GMS2 import emits prefab/scene JSON..." entry originally
 * left as a follow-up ("wiring these functions up to real prefab instances
 * ... is left to the game importing the project"). `GmlBehaviorSystem`
 * mirrors `VisualScriptSystem`'s shape: a tiny `Serializable` component
 * (`GmlBehaviorState`) naming which shared, module-level-registered behavior
 * an entity runs, and a system that walks `scene.each()` to dispatch it.
 *
 * GameMaker's own per-frame event order is the entire reason `update()` is
 * three full passes rather than one: "every instance's Begin Step completes
 * before any instance's Step begins; every instance's Step completes before
 * any instance's End Step begins" (GameMaker's real semantics — see
 * `steamcommunity.com/app/585410` "Useful information: Event order" and
 * `manual.gamemaker.io/lts/.../Event_Order.htm`, both confirmed live for
 * this pass). A single interleaved pass (call every handler for entity A,
 * then every handler for entity B, ...) would let entity B's Begin Step read
 * a Step-event write entity A already made this same frame, which is not
 * what GameMaker does — GameMaker's own engine completes an entire event
 * category across every instance before starting the next category. Two
 * entities racing to read/write each other's state across the Begin
 * Step/Step boundary is the whole reason this matters in practice, not just
 * a theoretical ordering nicety — see `GmlBehaviorSystem.test.ts`'s
 * cross-entity ordering assertions.
 */
export class GmlBehaviorSystem {
  private moduleFor(state: {
    behaviorId: string;
  }): GmlBehaviorModule | undefined {
    return getGmlBehavior(state.behaviorId);
  }

  /**
   * Dispatches `onCreate` for one entity, once. Call this right after
   * spawning an entity that carries `GmlBehaviorState` — the natural
   * integration point is `loadSceneFile()`'s per-spawned-entity hook
   * (`SceneFile.ts`'s `onSpawned` option), since that's the one place a
   * GMS2-imported scene's `prefabInstances` are actually instantiated onto a
   * live `Scene`. Not called automatically by `Scene.spawn()` itself — the
   * engine's core `Scene`/`Entity` types have no concept of "GML behavior"
   * and must not grow one just to serve this optional compat layer (the same
   * boundary `@emptysock/network`'s entity-mapping entry in CLAUDE.md draws
   * for its own optional add-on).
   */
  dispatchCreate(entity: Entity, ctx: GmlActionContext): void {
    const state = entity.get(GmlBehaviorState);
    if (state === undefined) return;
    this.moduleFor(state)?.onCreate?.(entity, ctx);
  }

  /**
   * Dispatches `onDestroy` (if the behavior module exports one) and then
   * destroys the entity via `scene.destroy()`. This — not a bare
   * `scene.destroy(entity)` — is the sanctioned way to destroy an entity
   * carrying `GmlBehaviorState`: `Scene.destroy()` itself has no
   * `GmlActionContext` to dispatch an `onDestroy` handler with (no `Scene`/
   * `Game`/`prefabs`/`rooms` map lives on the core `Scene` type, by design —
   * see CLAUDE.md's engine-environment-boundary-adjacent "engine defines the
   * interface, whoever has a live instance wires the concrete
   * implementation" pattern), so dispatching a real `onDestroy` needs a real
   * caller-supplied `ctx`, the same requirement every other action in
   * `compat/gmlActions.ts` already has. `action_kill_object` (GM8.1's
   * "Destroy Instance" action) should be called through this method's
   * pattern too when a project wires real behaviors — see that function's
   * own doc comment.
   */
  destroy(scene: Scene, entity: Entity, ctx: GmlActionContext): void {
    const state = entity.get(GmlBehaviorState);
    if (state !== undefined) {
      this.moduleFor(state)?.onDestroy?.(entity, ctx);
    }
    scene.destroy(entity);
  }

  /**
   * Runs every `GmlBehaviorState` entity's Step-family handlers once, in
   * three strictly separate global passes: every entity's `onStepBegin`
   * first, then every entity's `onUpdate` (GameMaker's plain "Step" event),
   * then every entity's `onStepEnd` — never interleaved. Each pass is a full
   * `scene.each()` sweep completed before the next pass starts, which is
   * what actually gives the ordering guarantee: pass (b) starting only after
   * *every* entity's pass (a) call has returned.
   */
  update(scene: Scene, dt: number, ctx: GmlActionContext): void {
    scene.each(GmlBehaviorState, (state, entity) => {
      this.moduleFor(state)?.onStepBegin?.(entity, ctx);
    });
    scene.each(GmlBehaviorState, (state, entity) => {
      this.moduleFor(state)?.onUpdate?.(entity, dt, ctx);
    });
    scene.each(GmlBehaviorState, (state, entity) => {
      this.moduleFor(state)?.onStepEnd?.(entity, ctx);
    });
  }

  /**
   * Dispatches every `GmlBehaviorState` entity's `onDraw` (world-space,
   * camera-affected) exactly once. `makeTarget(entity)` supplies a fresh
   * `GmlDrawTarget` for this one call — see `RenderPipeline`'s per-entity
   * pixi `Graphics` wrapper, rebuilt from scratch every call the same way
   * `ParticleEmitter`'s container is rebuilt every frame (CLAUDE.md's
   * "ParticleEmitter renders through a real pixi ParticleContainer" entry).
   * `ctx.drawTarget` is set only for the duration of this one call and
   * cleared immediately after, so a `draw_*` call made from `onUpdate`/
   * `onCreate` (outside a draw dispatch) sees `undefined` and no-ops
   * honestly rather than drawing to a stale target.
   */
  renderDraw(
    scene: Scene,
    ctx: GmlActionContext,
    makeTarget: (entity: Entity) => GmlDrawTarget | undefined,
  ): void {
    scene.each(GmlBehaviorState, (state, entity) => {
      const module = this.moduleFor(state);
      if (module?.onDraw === undefined) return;
      const drawTarget = makeTarget(entity);
      if (drawTarget === undefined) return;
      module.onDraw(entity, { ...ctx, drawTarget });
    });
  }

  /**
   * Dispatches every `GmlBehaviorState` entity's `onDrawGui` exactly once.
   * Identical shape to `renderDraw` — the camera-independence itself is not
   * this method's job at all. It comes entirely from *which* `GmlDrawTarget`
   * `makeTarget` hands back: `RenderPipeline` calls this with a target drawn
   * into a container mounted outside the camera-transformed world container
   * (see `RenderSystem`'s `guiStage`), so nothing here needs to know or care
   * about the camera transform — GameMaker's real "Draw GUI draws in screen
   * space" semantic falls out of the render-tree placement, not a
   * conditional in the dispatch code.
   */
  renderDrawGui(
    scene: Scene,
    ctx: GmlActionContext,
    makeTarget: (entity: Entity) => GmlDrawTarget | undefined,
  ): void {
    scene.each(GmlBehaviorState, (state, entity) => {
      const module = this.moduleFor(state);
      if (module?.onDrawGui === undefined) return;
      const drawTarget = makeTarget(entity);
      if (drawTarget === undefined) return;
      module.onDrawGui(entity, { ...ctx, drawTarget });
    });
  }
}

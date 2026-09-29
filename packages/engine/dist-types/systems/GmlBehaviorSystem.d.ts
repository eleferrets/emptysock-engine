import type { Entity } from "../Entity.js";
import type { Scene } from "../Scene.js";
import type { GmlActionContext } from "../compat/gmlActions.js";
import type { GmlDrawTarget } from "../compat/gml.js";
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
export declare class GmlBehaviorSystem {
  private moduleFor;
  /**
   * Runs one transpiled GML handler, catching and reporting (never
   * silently swallowing) anything it throws instead of letting it
   * propagate out of `update()`/`dispatchCreate()`/etc. A real GMS2 import
   * routinely contains genuinely unmodelled GML (an unmapped built-in
   * variable or function CLAUDE.md's own "surface as an unresolved
   * identifier, don't fake it" rule deliberately leaves untranspiled) —
   * confirmed against a real project, where one entity's `onCreate`
   * referencing an unmapped built-in (`view_camera[0]`) threw and, with no
   * isolation, aborted the *entire* room load before any other entity's
   * `onCreate` — including ones with no such gap — ever ran. One
   * behavior's broken/unmodelled GML must not be able to take down every
   * other entity's dispatch in the same pass, the same "partial success,
   * honestly reported" shape `SaveSystem`'s per-component migration
   * failures and `QueryChannel`'s `createEntity` `skipped` list already
   * use elsewhere in this codebase.
   */
  private safeCall;
  /**
   * Dispatches `onCreate` for one entity, once. Call this right after
   * spawning an entity that carries `GmlBehaviorState` — the natural
   * integration point is `loadSceneFile()`'s per-spawned-entity hook
   * (`SceneFile.ts`'s `onSpawned` option), since that's the one place a
   * GMS2-imported scene's prefab-instance entities are actually instantiated onto a
   * live `Scene`. Not called automatically by `Scene.spawn()` itself — the
   * engine's core `Scene`/`Entity` types have no concept of "GML behavior"
   * and must not grow one just to serve this optional compat layer (the same
   * boundary `@emptysock/network`'s entity-mapping entry in CLAUDE.md draws
   * for its own optional add-on).
   */
  dispatchCreate(entity: Entity, ctx: GmlActionContext): void;
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
  destroy(scene: Scene, entity: Entity, ctx: GmlActionContext): void;
  /**
   * Dispatches `onAlarm<index>` (if the entity's compiled module exports
   * one) for a GM8.1 alarm reaching zero — the real integration point for
   * `compat/gmlActions.ts`'s `gmlActionsStep(entity, onAlarm)` callback
   * parameter, per CLAUDE.md's `GmsProjectRuntime` entry. `gms2-codegen.ts`
   * names these handlers `onAlarm0`..`onAlarm11` (GameMaker has 12 alarm
   * slots), a dynamically-named export `GmlBehaviorModule`'s fixed fields
   * can't type directly — the same reason `onCollideWith<Other>` dispatch
   * already goes through `getGmlBehaviorHandler` rather than a static field
   * lookup, reused here rather than reinvented. A no-op, not an error, when
   * the entity has no `GmlBehaviorState`, no resolvable module, or no
   * handler for this particular alarm index — most real objects only ever
   * arm a couple of the 12 possible slots. Routed through `safeCall` like
   * every other dispatch in this class, so one throwing alarm handler can't
   * abort dispatch for any other entity or any other alarm firing the same
   * frame.
   */
  dispatchAlarm(entity: Entity, index: number, ctx: GmlActionContext): void;
  /**
   * Dispatches `onKeyPress<Name>` (GameMaker's KeyPress event for vk code
   * `vkCode`) for one entity, if its compiled module exports one — the
   * real integration point `GmsProjectRuntime`'s per-frame key-transition
   * poll calls into once a tracked key transitions from up to down. Handler
   * names are generated per-project (`gms2-codegen.ts`'s `vkMethodName`),
   * so this resolves the same way `dispatchAlarm`/`onCollideWith<Other>`
   * dispatch already do — `getGmlBehaviorHandler` by name, not a static
   * `GmlBehaviorModule` field — via `compat/gmlKeys.ts`'s `vkMethodName`,
   * a hand-kept-in-sync mirror of the toolchain's own naming (see that
   * module's doc comment for why the engine can't import the toolchain's
   * copy directly). A no-op, not an error, for a missing `GmlBehaviorState`,
   * an unresolvable module, or a vk code this entity's module has no
   * handler for — most real objects only ever handle a couple of keys.
   * Routed through `safeCall` like every other dispatch in this class.
   */
  dispatchKeyPress(entity: Entity, vkCode: number, ctx: GmlActionContext): void;
  /** See `dispatchKeyPress` — the down-to-up counterpart, `onKeyRelease<Name>`. */
  dispatchKeyRelease(
    entity: Entity,
    vkCode: number,
    ctx: GmlActionContext,
  ): void;
  private dispatchKeyEvent;
  /**
   * Runs every `GmlBehaviorState` entity's Step-family handlers once, in
   * three strictly separate global passes: every entity's `onStepBegin`
   * first, then every entity's `onUpdate` (GameMaker's plain "Step" event),
   * then every entity's `onStepEnd` — never interleaved. Each pass is a full
   * `scene.each()` sweep completed before the next pass starts, which is
   * what actually gives the ordering guarantee: pass (b) starting only after
   * *every* entity's pass (a) call has returned.
   */
  update(scene: Scene, dt: number, ctx: GmlActionContext): void;
  /**
   * A 4th, separate pass after the three Step-family passes above —
   * GameMaker's real per-frame event order runs Collision checks after Step
   * (Begin/normal/End) completes and before Draw, so this always runs last
   * within `update()`, once every `GmlBehaviorState` entity's Step-family
   * handlers have already had their say for this frame.
   *
   * GameMaker's real default (non-physics) instance collision model is
   * plain bounding-box overlap, checked every step, firing each instance's
   * Collision event specific to the *other* instance's object type — an
   * object can declare separate `Collision_A`/`Collision_B` handlers,
   * independently triggered only by overlap with that specific type. This
   * is a broad-phase-then-narrow-phase sweep: the broad phase collects
   * every `GmlBehaviorState` entity (a potential collision *source* — only
   * a source needs a compiled module to dispatch through) and every
   * `Transform`-bearing entity (a potential collision *target* — a target
   * needs no `GmlBehaviorState` of its own, since GameMaker's own Collision
   * event can be triggered by any instance, not just other
   * behavior-carrying ones), then the narrow phase is `checkGmlAabbOverlap`
   * (real AABB overlap, only computed for pairs that could plausibly
   * matter — see `GmlCollision.ts`).
   */
  private resolveCollisions;
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
  ): void;
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
  ): void;
  /**
   * Shared body of `renderDraw`/`renderDrawGui` — both dispatch the same
   * way (one `scene.each()` pass, skip an entity with no handler for this
   * pass, skip one `makeTarget` genuinely has nothing for, call the handler
   * with a fresh per-call `drawTarget` spliced into `ctx`). `pickHandler`
   * is the one thing that differs between the two passes.
   */
  private dispatchDraw;
}

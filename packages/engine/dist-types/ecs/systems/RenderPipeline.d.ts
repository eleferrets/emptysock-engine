import { Container, Texture } from "pixi.js";
import type { Renderer } from "pixi.js";
import type { Scene } from "../Scene.js";
import type { SceneRenderer } from "../Game.js";
import { type RenderSystemOptions } from "../../systems/RenderSystem.js";
import { LayerSystem } from "../../systems/LayerSystem.js";
/** Loads (and ideally caches) a texture for a given asset path. Swappable for tests/headless hosts. */
export type TextureLoader = (path: string) => Promise<Texture>;
export interface RenderPipelineOptions extends Omit<
  RenderSystemOptions,
  "layerSystem"
> {
  /** Supply a LayerSystem to share with other code; a fresh one is created otherwise. */
  layers?: LayerSystem;
  /** Override how texture paths resolve to PixiJS textures — defaults to `Assets.load`. */
  textureLoader?: TextureLoader;
}
/**
 * ECS-core equivalent of `../../systems/RenderPipeline.ts`, built on the `defineComponent`/
 * `Scene.each` object model, and `Game`'s `SceneRenderer` shape (ENGINE_DESIGN.md
 * §4 step 7 / §12.3). Reuses the classic `RenderSystem` (the raw PixiJS wrapper) and
 * `LayerSystem` (layer-level ordering/visibility, via `RenderSystem`'s
 * `getLayerContainer`/`syncLayerVisibility`) unchanged — neither imports the
 * classic `core/Entity.ts`/`Scene.ts`, so there was nothing incompatible
 * about them to begin with.
 *
 * **On PixiJS's native Render Layers (RELEASE_PASS.md Track 2), reversed
 * after auditing the actual code:** the original plan called for rebuilding
 * `LayerSystem` on PixiJS v8.7+'s `RenderLayer` API instead of the current
 * per-layer-`Container` approach. Auditing `RenderSystem.ts` first shows why
 * that doesn't help here: `RenderLayer.attach()` requires the attached
 * object to already have a real `Container` parent elsewhere for
 * transforms, and throws on `addChild()` itself — but this renderer already
 * writes sprites' `x`/`y` in absolute coordinates directly onto the sprite
 * (no nested world-transform hierarchy `RenderLayer` would decouple draw
 * order from), and `getLayerContainer(name)`'s callers (this class *and*
 * the classic `RenderPipeline`, both real, both staying) already do
 * `container.addChild(pixiSprite)` directly. Swapping to `RenderLayer`
 * would mean reworking `RenderSystem`'s shared public API (used by both
 * pipelines) for a decoupling this flat architecture has no actual use
 * for. The one real bug the original plan was chasing — `LayerSystem`'s
 * per-entity placement map (`addEntity`/`removeEntity`/`getEntityLayer`/
 * `getEntityDepth`) being raw-eid-keyed with no scene scoping — turned out
 * to have zero real readers anywhere in the codebase (confirmed by grep:
 * `getEntityLayer`/`getEntityDepth`/`getEntitiesOnLayer` are called
 * nowhere, not even by the classic pipeline that also writes to them) —
 * it was writing per-frame bookkeeping data that got read by nothing, not
 * a scoping bug actively corrupting real behavior. This class no longer
 * calls `addEntity`/`removeEntity` at all (dead write removed); the layer-
 * *level* concepts `LayerSystem` still provides (name → index/visibility)
 * remain real and unchanged, since `RenderSystem` genuinely needs those for
 * stage ordering and `syncLayerVisibility()`.
 *
 * On `renderFrame(main, overlays)` it:
 *
 *  1. Walks `main` for every `Transform`+`Sprite` entity via `scene.each` (the
 *     bulk-iteration path, ENGINE_DESIGN.md §21 — no per-entity Proxy
 *     overhead), keeps a PixiJS sprite in sync with it, and places it on
 *     `layer`/`depth`.
 *  2. Does the same for each overlay `Scene`, but into a dedicated container
 *     appended to the stage *after* the main scene's layer containers — Pixi
 *     draws children in `addChild` order, so later-appended containers paint
 *     on top. Overlays are synced in the array's order, i.e. call order
 *     (ENGINE_DESIGN.md §12.3), so the most recently `loadOverlay()`-ed scene
 *     ends up topmost.
 *  3. Renders the frame.
 *
 * **Multiple live scenes and entity id collisions**: every `Scene` owns its
 * own bitECS `World`, and each `World`'s entity ids independently start from
 * 0 (see `Scene.ts`). A `Game` with a main scene plus one or more overlays
 * therefore has several *different* entities that all report `eid === 3`.
 * Tracking sprites in one flat `Map<number, PixiSprite>` (what the classic
 * single-scene `RenderPipeline` does, and all it ever needed to do) would silently
 * alias an overlay's entity 3 onto the main scene's. This class instead keys
 * its sprite/texture-path tracking per `Scene` (`Map<Scene, SceneTracking>`)
 * — one level of scoping up from `ComponentRegistry`'s per-`World` scoping
 * and `PhysicsBody`'s per-`World` callback side-table (`ecs/components/PhysicsBody.ts`),
 * but the same underlying idea: never index directly by a raw entity id
 * without first scoping by which scene's world it belongs to.
 *
 * That per-`Scene` scoping covers the *main* scene too, not just overlays:
 * `Game.unloadScene()`/`loadScene()` swap in a brand new `Scene` (a new
 * bitECS `World`, entity ids starting at 0 again), so a single flat
 * `_mainTracking` object reused across that swap would alias the old
 * scene's leftover Pixi sprites onto the new scene's same-numbered
 * entities, and leave the old sprites themselves never destroyed. `_syncMain`
 * tracks which `Scene` its tracking currently belongs to (`_mainScene`) and,
 * the moment a *different* `Scene` object is passed in, fully disposes the
 * previous one's tracking (`_releaseMain`, sharing the exact same per-sprite
 * teardown `releaseOverlay`/`_pruneOverlays` already use for overlays)
 * before starting fresh — main-scene tracking and overlay tracking now share
 * one underlying `Map<Scene, SceneTracking>`.
 */
export declare class RenderPipeline implements SceneRenderer {
  private readonly _render;
  private readonly _layers;
  private readonly _loadTexture;
  /** Shared by the main scene and every overlay — see the class doc comment above. */
  private readonly _tracking;
  private _mainScene;
  private readonly _overlayContainers;
  private readonly _textureCache;
  private readonly _sortedLayers;
  constructor(options?: RenderPipelineOptions);
  /**
   * Constructs the real PixiJS renderer (WebGL by default — ENGINE_DESIGN.md
   * §18's audit finding: "Pixi's own guidance is still to prefer WebGL for
   * production"; `RenderSystem.init()` already passes
   * `preference: ["webgpu", "webgl"]` to `autoDetectRenderer`, i.e. it tries
   * WebGPU first and falls back, so WebGPU stays available as an explicit
   * opt-in on hosts that force it — nothing here changes that). Needs a real
   * DOM/canvas environment; never call this under the headless testing
   * harness (`createHeadlessGame()` never attaches a `RenderPipeline` at
   * all — see `Game.attachRenderer`/`ecs/Game.ts` step 7 — so game code
   * driven purely through `testing/index.ts` never reaches this call).
   */
  init(options?: RenderPipelineOptions): Promise<void>;
  /** The engine's LayerSystem — call `defineLayer()` on it for custom draw order. */
  get layers(): LayerSystem;
  get renderer(): Renderer;
  get stage(): Container;
  get canvas(): HTMLCanvasElement;
  resize(width: number, height: number): void;
  /**
   * `Game.update()` step 7's entry point (via `Game.attachRenderer(this)` —
   * this method is what makes `RenderPipeline` satisfy `SceneRenderer`
   * structurally). Syncs the main scene, then every overlay in call order,
   * releases tracking for any overlay no longer present in `overlays`, and
   * renders once.
   */
  renderFrame(main: Scene, overlays?: readonly Scene[]): void;
  /** Sync the main scene's PixiJS sprites without rendering. Exposed for tests/custom loops. */
  syncEntities(scene: Scene): void;
  private _syncMain;
  /** Fully tear down the current main scene's tracking — same per-sprite teardown `releaseOverlay` uses. */
  private _releaseMain;
  private _syncOverlay;
  private _syncOne;
  private _containerFor;
  private _overlayContainer;
  private _applyTexture;
  private _removeSprite;
  /**
   * Drop tracking (and destroy sprites) for any overlay scene not present in
   * `active` — called every `renderFrame()` with the caller's current
   * overlay list, so an unloaded overlay's leftover sprites don't linger
   * until the next mismatched sync. `Game.unloadOverlay()` doesn't need to
   * know this class exists at all; this runs the cleanup lazily on the very
   * next `renderFrame()` after the overlay stops appearing in `overlays`.
   */
  private _pruneOverlays;
  /** Explicitly release an overlay's tracking/container — safe to call even if `renderFrame` would have pruned it anyway. */
  releaseOverlay(scene: Scene): void;
  destroy(): void;
}

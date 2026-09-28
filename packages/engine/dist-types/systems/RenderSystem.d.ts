import { Container, type Filter, type Renderer } from "pixi.js";
import type { LayerSystem } from "./LayerSystem.js";
import type { GPUTier } from "../GPUTier.js";
import { type PostProcessSystem } from "./PostProcessSystem.js";
import type { LightingSystem } from "./LightingSystem.js";
import type { Scene } from "../Scene.js";
/**
 * The structural shape `renderMultiCamera()` needs from one active camera
 * slot. Re-declared here rather than importing `GmlCameraViewport` from
 * `compat/gmlCamera.ts` — `RenderSystem.ts` is core engine rendering and
 * must stay usable by any game, not just GML-imported ones; `compat/` is a
 * GameMaker-specific translation layer that depends on the engine, never
 * the other way around (the same layering rule `RenderPipeline`'s
 * `TileLayerSource` interface already follows for `@emptysock/tilemap`).
 * `compat/gmlCamera.ts`'s exported `GmlCameraViewport` is structurally
 * identical to this and satisfies it with no adapter needed.
 */
export interface CameraViewport {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
  readonly rotation: number;
  readonly viewWidth: number;
  readonly viewHeight: number;
  readonly screenX: number;
  readonly screenY: number;
  readonly screenWidth: number;
  readonly screenHeight: number;
}
export interface RenderSystemOptions {
  width?: number;
  height?: number;
  backgroundColor?: number;
  antialias?: boolean;
  resolution?: number;
  layerSystem?: LayerSystem;
  /**
   * When provided (and `antialias`/`resolution` are not explicitly set),
   * caps resolution and disables antialiasing below "mid" tier so weak GPUs
   * (older mobile, integrated) don't pay full fill-rate cost. See
   * gpuTierRenderDefaults() in ViewportSystem.ts for the thresholds.
   */
  gpuTier?: GPUTier;
}
export declare class RenderSystem {
  private _renderer;
  private _stage;
  /**
   * The actual pixi tree root passed to `renderer.render()`. Contains
   * `_stage` (the camera-transformable container `CameraSystem.attach()`
   * targets — see `stage`'s getter, unchanged) and `_guiStage` as siblings.
   * `CameraSystem` only ever writes `_stage.x`/`.y`/`.scale`/`.rotation`, so
   * a sibling container is never touched by that transform no matter what
   * the camera does — this is what makes Draw GUI's screen-space guarantee
   * a structural property of the render tree, not a per-call check. See
   * CLAUDE.md's "GML behavior dispatch..." entry for the full rationale.
   */
  private _root;
  /**
   * Camera-independent overlay root, rendered after (i.e. on top of)
   * `_stage`. `RenderPipeline.guiLayer` exposes this for `GmlBehaviorSystem`
   * Draw GUI dispatch; nothing else mounts into it today.
   */
  private _guiStage;
  private _canvas;
  private _layerSystem;
  /** Per-layer PixiJS containers keyed by layer name. */
  private _layerContainers;
  /** Fallback single-container used when no LayerSystem is set. */
  private _defaultContainer;
  /** Real pixi Filter instances built from `PostProcessSystem.layerFilters`, keyed by layer id, reused across frames so `syncPostProcessLayerFilters` doesn't reallocate a GPU filter every call. */
  private _postProcessFilters;
  /**
   * Wall-clock seconds at the last `syncPostProcessLayerFilters()` call
   * that had at least one live `rain-glass` filter — used to compute the
   * `dtSeconds` passed to `RainGlassFilter.tick()`. `null` until the first
   * such call, so the very first tick advances by 0 rather than by however
   * long the engine had been running before rain-glass was ever enabled.
   */
  private _rainGlassLastTick;
  /** Real pixi objects `syncLighting()` builds and reuses across frames — see that method's doc comment. */
  private _lightingFilter;
  private _lightMapTexture;
  private _lightMapContainer;
  private _lightingLayerId;
  /** Per-viewport-id offscreen render targets `renderMultiCamera()` reuses across frames. */
  private _multiCameraTextures;
  /** Per-viewport-id screen-quad sprites `renderMultiCamera()` reuses across frames. */
  private _multiCameraSprites;
  /** The compositor container `renderMultiCamera()` renders straight to the canvas as its final pass. */
  private _multiCameraCompositor;
  init(options?: RenderSystemOptions): Promise<void>;
  /**
   * Attach a LayerSystem. May be called after init(). When set, entities
   * should be added to the container returned by getLayerContainer() rather
   * than directly to stage.
   */
  setLayerSystem(ls: LayerSystem): void;
  /**
   * Rebuild the ordered set of per-layer PixiJS Containers from the current
   * LayerSystem state. Call after defineLayer() calls if layers are added
   * dynamically after init.
   */
  private _rebuildLayerContainers;
  /**
   * Return the PixiJS Container for a given layer name. Creates it if it does
   * not yet exist (e.g. a layer was defined after init). Falls back to the
   * default container when no LayerSystem is active.
   */
  getLayerContainer(layerName?: string): Container;
  /**
   * Insert a newly created layer container into the stage at the correct
   * index relative to already-present containers, respecting layer index order.
   */
  private _insertContainerOrdered;
  /**
   * Synchronise layer container visibility from LayerSystem state. Call once
   * per frame (or on demand) after setVisible() calls.
   */
  syncLayerVisibility(): void;
  /**
   * Attach a custom shader filter (e.g. from `createCustomShaderFilter()`)
   * to a layer's container. This is the real counterpart to the ShaderEditor
   * IDE panel's live preview — the same Filter instance a shader authored
   * there produces is what gets attached here.
   */
  addLayerShaderFilter(layerName: string, filter: Filter): void;
  /** Detach a previously attached shader filter from a layer's container. */
  removeLayerShaderFilter(layerName: string, filter: Filter): void;
  /**
   * Reads `postProcess.layerFilters` and applies the real PixiJS filter for
   * each entry to that layer's container, per the effect-to-library mapping
   * decided in RELEASE_PASS.md Track 0's scope-hardening section: `blur` →
   * pixi.js core's `BlurFilter`; `brightness`/`contrast`/`saturate`/
   * `hue-rotate`/`invert`/`colour-grade`/`colourblind` → pixi.js core's
   * `ColorMatrixFilter` (colourblind reuses `PostProcessSystem`'s own
   * Brettel/Viénot/Machado simulation matrices via `.multiply()`, the exact
   * same coefficients the CSS/SVG fallback in `cssFilterForLayer()` uses);
   * `outline` → `pixi-filters`' `OutlineFilter`. `cssFilterForLayer()` is
   * untouched and still exists for hosts (the browser preview iframe) that
   * render a layer as a DOM element rather than a PixiJS container.
   *
   * One filter instance per layer id is built once and reused across calls
   * — call this every frame from `render()`'s caller; it does not rebuild a
   * filter unless the layer's filter *type* actually changed, and layers
   * whose filter was cleared or disabled since the last call get their
   * filter detached.
   */
  syncPostProcessLayerFilters(postProcess: PostProcessSystem): void;
  /**
   * Advances every live `RainGlassFilter`'s `uTime` uniform by the wall-clock
   * seconds elapsed since the last call that had at least one — droplets
   * fall by real time, not by frame count, so this stays correct under a
   * variable frame rate the same way `Game.update(dt)`'s own delta-time
   * loop does elsewhere in the engine.
   */
  private _tickRainGlassFilters;
  private _clearPostProcessFilter;
  private _applyPostProcessFilter;
  private _createPostProcessFilter;
  private _configurePostProcessFilter;
  /**
   * Real 2D dynamic point lighting — see CLAUDE.md's "LightingSystem: real
   * 2D point lights via a baked lightmap, not a hand-rolled shader" entry
   * for the full rationale. `LightingSystem` (framework-agnostic) decides
   * *which* lights are live; this method is the one place that turns them
   * into pixels, following the exact split `syncPostProcessLayerFilters`
   * already established (a framework-agnostic system feeds a plain options
   * object, `RenderSystem` builds/reuses the real pixi objects).
   *
   * The technique: every light is drawn as a set of concentric, additively
   * blended filled circles (`Graphics.circle().fill()`, outer ring first,
   * each ring's alpha the *increment* of a `(1 - t)^falloff` intensity curve
   * between it and the next ring in) into an offscreen `RenderTexture` sized
   * to `viewport` — the "lightmap". `pixi-filters`' real `SimpleLightmapFilter`
   * (already an engine dependency, already used for PostProcessSystem's
   * `outline` mapping) is then attached to `layerId` via the same
   * `addLayerShaderFilter()` every other post-process filter in this file
   * uses; its shader does `sceneColour * (ambientColour * ambientLevel +
   * lightmap.rgb)` — read straight from its own real WGSL source — which is
   * exactly "pitch black except lit areas" at `ambient.level = 0` and "no
   * darkness at all" at `ambient.level = 1`.
   *
   * Concentric rings rather than a `FillGradient` radial fill: `FillGradient`
   * bakes its gradient into a texture the first time it's used, and that
   * path has not been verified to run under the headless Node/Vitest harness
   * (no confirmed canvas-free code path) — concentric `Graphics.circle()`
   * calls are the same primitive `compat/gml.ts`'s `draw_circle` and
   * `RenderPipeline`'s scene-transition overlay already use, so this stays
   * on a rendering primitive this codebase has already verified works
   * headless. One `RenderTexture` and one lightmap `Container` are built
   * once and reused/resized across calls, the same "don't reallocate a GPU
   * resource every frame" discipline `_postProcessFilters` already follows;
   * the per-light `Graphics` objects are rebuilt from scratch every call
   * (the same "simplicity over per-frame allocation cost" tradeoff
   * `ParticleEmitter`'s pixi wiring already accepts).
   *
   * `viewport` is the world-space rect the lightmap should cover — normally
   * the camera's visible area. Lights outside it still count toward
   * `LightingSystem.maxLights`'s nearest-N cap (`collectLights()` doesn't
   * know about the viewport rect, only a reference point) but contribute
   * nothing to a lightmap that doesn't cover them, which is the correct,
   * honest behaviour — a light fully offscreen has no visible effect to fake.
   */
  syncLighting(
    lighting: LightingSystem,
    scene: Scene,
    layerId: string,
    viewport: {
      x: number;
      y: number;
      width: number;
      height: number;
    },
  ): void;
  /** Detach and destroy whatever `syncLighting()` built. Call from scene teardown if a scene turns lighting off entirely. */
  clearLighting(): void;
  /**
   * Real GameMaker-style multi-camera compositing: renders the *same*
   * `_stage` content once per active viewport (each pass using that
   * viewport's own position/zoom/rotation, the exact convention
   * `CameraSystem.update()` already writes to `_stage` — `stage.x =
   * -viewport.x`, `.y = -viewport.y`, `.scale = viewport.zoom`, `.rotation =
   * viewport.rotation`, so a single-camera game and a multi-camera one agree
   * on what "camera position" means) into that viewport's own offscreen
   * `RenderTexture` (pixi v8's real object-form `renderer.render({
   * container, target })` API — the same one CLAUDE.md's
   * `SceneTransitionManager` entry already names as real and available, and
   * the one `syncLighting()` above already uses for its lightmap pass), then
   * draws every one of those textures as a plain `Sprite` quad positioned at
   * that viewport's own screen rectangle (`screenX`/`screenY`/
   * `screenWidth`/`screenHeight`) in one final pass straight to the real
   * canvas.
   *
   * This is genuinely opt-in: it mutates `_stage`'s transform only for the
   * duration of its own per-viewport render passes, restoring exactly what
   * was there before returning — a `CameraSystem` driving the ordinary
   * single-camera `render()` path never sees any effect from a call here,
   * and `render()` itself is completely untouched by this method's
   * existence. Call this instead of `render()` for a frame that wants
   * GameMaker's multiple-simultaneous-view-slot rendering (see
   * `compat/gmlCamera.ts`'s `buildActiveGmlCameraViewports()`, which
   * produces the `viewports` array this method expects); call `render()` as
   * before for the ordinary single-camera case.
   *
   * One `RenderTexture`/`Sprite` pair is cached per viewport `id` and reused
   * across calls (resized only when that viewport's `viewWidth`/`viewHeight`
   * actually changed) — the same "don't reallocate a GPU resource every
   * frame" discipline `_lightMapTexture`/`_postProcessFilters` already
   * follow. A viewport id that stops appearing in `viewports` (camera
   * disabled, view slot turned off) has its cached texture/sprite destroyed
   * and dropped on the next call, not left leaking.
   *
   * A real N-full-render-pass-per-frame cost, same caveat
   * `SceneTransitionManager`'s and this file's own `syncLighting()`'s doc
   * comments already raise: bounded by how many camera slots a game
   * actually activates at once, not GameMaker's fixed 8-slot ceiling, but
   * still needs real device profiling before a game leans on many
   * simultaneous cameras — this method does not attempt that profiling.
   */
  renderMultiCamera(viewports: readonly CameraViewport[]): void;
  get renderer(): Renderer;
  get stage(): Container;
  get canvas(): HTMLCanvasElement;
  /**
   * Camera-independent overlay container — a sibling of `stage`, never a
   * descendant of it, so `CameraSystem.attach(stage)`'s pan/zoom/rotate
   * writes to `stage` never reach anything mounted here. See `_guiStage`'s
   * doc comment.
   */
  get guiStage(): Container;
  render(): void;
  resize(width: number, height: number): void;
  destroy(): void;
}
//# sourceMappingURL=RenderSystem.d.ts.map

import {
  autoDetectRenderer,
  BlurFilter,
  ColorMatrixFilter,
  Container,
  Graphics,
  RenderTexture,
  Sprite,
  type Filter,
  type Renderer,
} from "pixi.js";
import { OutlineFilter, SimpleLightmapFilter } from "pixi-filters";
import type { LayerSystem } from "./LayerSystem.js";
import { gpuTierRenderDefaults } from "./ViewportSystem.js";
import type { GPUTier } from "../GPUTier.js";
import {
  COLOURBLIND_MATRICES,
  type LayerFilterOptions,
  type LayerFilterType,
  type PostProcessSystem,
} from "./PostProcessSystem.js";
import type { LightingSystem, LightSample } from "./LightingSystem.js";
import type { Scene } from "../Scene.js";
import {
  RainGlassFilter,
  type RainGlassFilterOptions,
} from "./RainGlassFilter.js";

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

/** Number of concentric rings drawn per light — see `syncLighting()`'s doc comment. */
const LIGHT_FALLOFF_RINGS = 8;

/**
 * One light → a `Graphics` of concentric, additively blended filled circles
 * approximating a `(1 - t)^falloff` radial intensity curve. `originX`/`originY`
 * shift world-space light coordinates into the lightmap texture's local
 * space (the lightmap only ever covers `viewport`, not the whole world).
 *
 * When `light.visibility` is set (real occlusion — see
 * `LightingSystem.collectLights()`'s doc comment and `LightOcclusion.ts`),
 * the returned `Graphics`' `.mask` is set to a second `Graphics` filling the
 * light's real visible-region polygon, in the same local coordinate space —
 * a genuine pixi geometric mask, not a CSS/filter approximation, which is
 * what makes a point directly behind an occluder receive none of this
 * light's contribution to the lightmap texture rather than a merely dimmer
 * one. The mask `Graphics` is deliberately never added to
 * `_lightMapContainer` — pixi masks a display object against another
 * display object's geometry without requiring the mask to be in the scene
 * graph itself, as long as both share the same coordinate space, which
 * local-origin-relative light/mask coordinates here already guarantee.
 * `light.visibility === null` (no occluder was within this light's radius —
 * the common case) skips masking entirely, so an unoccluded light renders
 * byte-for-byte the same un-masked circle this function always drew.
 */
function buildLightGraphics(
  light: LightSample,
  originX: number,
  originY: number,
): Graphics {
  const graphics = new Graphics();
  graphics.blendMode = "add";
  const localX = light.x - originX;
  const localY = light.y - originY;
  const falloff = Math.max(0.01, light.falloff);

  let previousIntensity = 0;
  for (let ring = LIGHT_FALLOFF_RINGS; ring >= 1; ring--) {
    const t = ring / LIGHT_FALLOFF_RINGS;
    const intensity = Math.pow(1 - t, falloff);
    const delta = intensity - previousIntensity;
    previousIntensity = intensity;
    if (delta <= 0) continue;
    const alpha = Math.min(1, Math.max(0, delta * light.intensity));
    if (alpha <= 0) continue;
    graphics
      .circle(localX, localY, light.radius * t)
      .fill({ color: light.colour, alpha });
  }

  if (light.visibility !== null && light.visibility.length >= 3) {
    const mask = new Graphics();
    const points: number[] = [];
    for (const p of light.visibility) {
      points.push(p.x - originX, p.y - originY);
    }
    mask.poly(points).fill(0xffffff);
    graphics.mask = mask;
  }

  return graphics;
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

export class RenderSystem {
  private _renderer: Renderer | null = null;
  private _stage: Container | null = null;
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
  private _root: Container | null = null;
  /**
   * Camera-independent overlay root, rendered after (i.e. on top of)
   * `_stage`. `RenderPipeline.guiLayer` exposes this for `GmlBehaviorSystem`
   * Draw GUI dispatch; nothing else mounts into it today.
   */
  private _guiStage: Container | null = null;
  private _canvas: HTMLCanvasElement | null = null;
  private _layerSystem: LayerSystem | null = null;
  /** Per-layer PixiJS containers keyed by layer name. */
  private _layerContainers: Map<string, Container> = new Map();
  /** Fallback single-container used when no LayerSystem is set. */
  private _defaultContainer: Container | null = null;
  /** Real pixi Filter instances built from `PostProcessSystem.layerFilters`, keyed by layer id, reused across frames so `syncPostProcessLayerFilters` doesn't reallocate a GPU filter every call. */
  private _postProcessFilters: Map<
    string,
    { type: LayerFilterType; filter: Filter }
  > = new Map();
  /**
   * Wall-clock seconds at the last `syncPostProcessLayerFilters()` call
   * that had at least one live `rain-glass` filter — used to compute the
   * `dtSeconds` passed to `RainGlassFilter.tick()`. `null` until the first
   * such call, so the very first tick advances by 0 rather than by however
   * long the engine had been running before rain-glass was ever enabled.
   */
  private _rainGlassLastTick: number | null = null;
  /** Real pixi objects `syncLighting()` builds and reuses across frames — see that method's doc comment. */
  private _lightingFilter: SimpleLightmapFilter | null = null;
  private _lightMapTexture: RenderTexture | null = null;
  private _lightMapContainer: Container | null = null;
  private _lightingLayerId: string | null = null;
  /** Per-viewport-id offscreen render targets `renderMultiCamera()` reuses across frames. */
  private _multiCameraTextures: Map<number, RenderTexture> = new Map();
  /** Per-viewport-id screen-quad sprites `renderMultiCamera()` reuses across frames. */
  private _multiCameraSprites: Map<number, Sprite> = new Map();
  /** The compositor container `renderMultiCamera()` renders straight to the canvas as its final pass. */
  private _multiCameraCompositor: Container | null = null;

  async init(options: RenderSystemOptions = {}): Promise<void> {
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio : 1;
    const tierDefaults =
      options.gpuTier !== undefined
        ? gpuTierRenderDefaults(options.gpuTier, dpr)
        : { antialias: true, resolution: dpr };

    this._renderer = await autoDetectRenderer({
      width: options.width ?? 1280,
      height: options.height ?? 720,
      backgroundColor: options.backgroundColor ?? 0x0e0e10,
      antialias: options.antialias ?? tierDefaults.antialias,
      resolution: options.resolution ?? tierDefaults.resolution,
      powerPreference: "high-performance",
      preference: ["webgpu", "webgl"],
    });

    this._canvas = this._renderer.canvas as HTMLCanvasElement;
    this._stage = new Container();
    this._guiStage = new Container();
    this._root = new Container();
    this._root.addChild(this._stage);
    this._root.addChild(this._guiStage);

    if (options.layerSystem) {
      this.setLayerSystem(options.layerSystem);
    } else {
      // No LayerSystem — single default container preserves legacy behaviour.
      this._defaultContainer = new Container();
      this._stage.addChild(this._defaultContainer);
    }
  }

  /**
   * Attach a LayerSystem. May be called after init(). When set, entities
   * should be added to the container returned by getLayerContainer() rather
   * than directly to stage.
   */
  setLayerSystem(ls: LayerSystem): void {
    this._layerSystem = ls;
    // Remove any existing legacy default container.
    if (this._defaultContainer && this._stage) {
      this._stage.removeChild(this._defaultContainer);
      this._defaultContainer = null;
    }
    // Rebuild layer containers ordered by index.
    this._rebuildLayerContainers();
  }

  /**
   * Rebuild the ordered set of per-layer PixiJS Containers from the current
   * LayerSystem state. Call after defineLayer() calls if layers are added
   * dynamically after init.
   */
  private _rebuildLayerContainers(): void {
    if (!this._stage || !this._layerSystem) return;

    // Detach existing layer containers from stage.
    for (const container of this._layerContainers.values()) {
      this._stage.removeChild(container);
    }
    this._layerContainers.clear();

    const sorted = this._layerSystem.getLayersSorted();
    for (const layer of sorted) {
      const container = new Container();
      container.visible = layer.visible;
      this._layerContainers.set(layer.name, container);
      this._stage.addChild(container);
    }
  }

  /**
   * Return the PixiJS Container for a given layer name. Creates it if it does
   * not yet exist (e.g. a layer was defined after init). Falls back to the
   * default container when no LayerSystem is active.
   */
  getLayerContainer(layerName: string = "default"): Container {
    if (!this._layerSystem) {
      if (!this._defaultContainer)
        throw new Error("RenderSystem not initialized");
      return this._defaultContainer;
    }

    let container = this._layerContainers.get(layerName);
    if (!container) {
      // Layer was defined after init — create and insert it at the right z-position.
      container = new Container();
      this._layerContainers.set(layerName, container);
      if (this._stage) {
        this._insertContainerOrdered(layerName, container);
      }
    }
    return container;
  }

  /**
   * Insert a newly created layer container into the stage at the correct
   * index relative to already-present containers, respecting layer index order.
   */
  private _insertContainerOrdered(
    layerName: string,
    container: Container,
  ): void {
    if (!this._stage || !this._layerSystem) return;
    const sorted = this._layerSystem.getLayersSorted();
    const ownIndex = this._layerSystem.getLayerIndex(layerName);

    // Find how many existing stage children (layer containers) have a lower
    // layer index than this one, then insert after them.
    let insertAt = 0;
    for (const layer of sorted) {
      if (layer.name === layerName) break;
      if (layer.index < ownIndex && this._layerContainers.has(layer.name)) {
        insertAt++;
      }
    }
    this._stage.addChildAt(container, insertAt);
  }

  /**
   * Synchronise layer container visibility from LayerSystem state. Call once
   * per frame (or on demand) after setVisible() calls.
   */
  syncLayerVisibility(): void {
    if (!this._layerSystem) return;
    for (const [name, container] of this._layerContainers) {
      container.visible = this._layerSystem.isVisible(name);
    }
  }

  /**
   * Synchronise layer container position from `LayerSystem.getOffset()` —
   * the real render-side half of GameMaker's `layer_x`/`layer_y` compat
   * functions (`compat/gmlLayer.ts`). A layer with no offset ever set reads
   * `{ x: 0, y: 0 }` (`LayerSystem.getOffset()`'s own default), so an
   * offset-free scene renders byte-identical to before this existed. Call
   * once per frame alongside `syncLayerVisibility()`.
   */
  syncLayerOffsets(): void {
    if (!this._layerSystem) return;
    for (const [name, container] of this._layerContainers) {
      const offset = this._layerSystem.getOffset(name);
      container.x = offset.x;
      container.y = offset.y;
    }
  }

  /**
   * Attach a custom shader filter (e.g. from `createCustomShaderFilter()`)
   * to a layer's container. This is the real counterpart to the ShaderEditor
   * IDE panel's live preview — the same Filter instance a shader authored
   * there produces is what gets attached here.
   */
  addLayerShaderFilter(layerName: string, filter: Filter): void {
    const container = this.getLayerContainer(layerName);
    // `Container.filters` is typed `readonly Filter[]` (never null/undefined)
    // but a freshly constructed Container actually has it unset until first
    // assigned — spreading it directly throws on a container's first filter.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- pixi.js's own type is wrong about this at runtime
    container.filters = [...(container.filters ?? []), filter];
  }

  /** Detach a previously attached shader filter from a layer's container. */
  removeLayerShaderFilter(layerName: string, filter: Filter): void {
    const container = this.getLayerContainer(layerName);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- pixi.js's own type is wrong about this at runtime
    container.filters = (container.filters ?? []).filter((f) => f !== filter);
  }

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
  syncPostProcessLayerFilters(postProcess: PostProcessSystem): void {
    const seen = new Set<string>();
    for (const [layerId, opts] of postProcess.layerFilters) {
      seen.add(layerId);
      if (opts.enabled === false || opts.type === "none") {
        this._clearPostProcessFilter(layerId);
        continue;
      }
      this._applyPostProcessFilter(layerId, opts);
    }
    for (const layerId of [...this._postProcessFilters.keys()]) {
      if (!seen.has(layerId)) this._clearPostProcessFilter(layerId);
    }
    this._tickRainGlassFilters();
  }

  /**
   * Advances every live `RainGlassFilter`'s `uTime` uniform by the wall-clock
   * seconds elapsed since the last call that had at least one — droplets
   * fall by real time, not by frame count, so this stays correct under a
   * variable frame rate the same way `Game.update(dt)`'s own delta-time
   * loop does elsewhere in the engine.
   */
  private _tickRainGlassFilters(): void {
    const rainFilters: RainGlassFilter[] = [];
    for (const entry of this._postProcessFilters.values()) {
      if (entry.type === "rain-glass")
        rainFilters.push(entry.filter as RainGlassFilter);
    }
    if (rainFilters.length === 0) {
      this._rainGlassLastTick = null;
      return;
    }
    const now = Date.now() / 1000;
    const dt =
      this._rainGlassLastTick === null ? 0 : now - this._rainGlassLastTick;
    this._rainGlassLastTick = now;
    for (const rain of rainFilters) rain.tick(dt);
  }

  private _clearPostProcessFilter(layerId: string): void {
    const entry = this._postProcessFilters.get(layerId);
    if (entry === undefined) return;
    this.removeLayerShaderFilter(layerId, entry.filter);
    entry.filter.destroy();
    this._postProcessFilters.delete(layerId);
  }

  private _applyPostProcessFilter(
    layerId: string,
    opts: LayerFilterOptions,
  ): void {
    const existing = this._postProcessFilters.get(layerId);
    if (existing !== undefined && existing.type !== opts.type) {
      this._clearPostProcessFilter(layerId);
    }
    let entry = this._postProcessFilters.get(layerId);
    if (entry === undefined) {
      const filter = this._createPostProcessFilter(opts.type);
      if (filter === null) return;
      entry = { type: opts.type, filter };
      this._postProcessFilters.set(layerId, entry);
      this.addLayerShaderFilter(layerId, filter);
    }
    this._configurePostProcessFilter(entry.filter, opts);
  }

  private _createPostProcessFilter(type: LayerFilterType): Filter | null {
    switch (type) {
      case "blur":
        return new BlurFilter();
      case "outline":
        return new OutlineFilter();
      case "brightness":
      case "contrast":
      case "saturate":
      case "hue-rotate":
      case "invert":
      case "colour-grade":
      case "colourblind":
        return new ColorMatrixFilter();
      case "rain-glass":
        return new RainGlassFilter();
      default:
        return null;
    }
  }

  private _configurePostProcessFilter(
    filter: Filter,
    opts: LayerFilterOptions,
  ): void {
    switch (opts.type) {
      case "blur":
        (filter as BlurFilter).strength = opts.radius ?? 4;
        return;
      case "outline": {
        const outline = filter as OutlineFilter;
        outline.thickness = opts.thickness ?? 1;
        outline.color = opts.colour ?? 0x000000;
        return;
      }
      case "brightness": {
        const cm = filter as ColorMatrixFilter;
        cm.reset();
        cm.brightness(opts.value ?? 1, false);
        return;
      }
      case "contrast": {
        const cm = filter as ColorMatrixFilter;
        cm.reset();
        cm.contrast(opts.value ?? 1, false);
        return;
      }
      case "saturate": {
        const cm = filter as ColorMatrixFilter;
        cm.reset();
        cm.saturate(opts.value ?? 1, false);
        return;
      }
      case "hue-rotate": {
        const cm = filter as ColorMatrixFilter;
        cm.reset();
        cm.hue(opts.degrees ?? 0, false);
        return;
      }
      case "invert": {
        const cm = filter as ColorMatrixFilter;
        cm.reset();
        cm.negative(false);
        return;
      }
      case "colour-grade": {
        const cm = filter as ColorMatrixFilter;
        cm.reset();
        cm.saturate(opts.saturation ?? opts.value ?? 1, true);
        cm.brightness(opts.value ?? 1, true);
        cm.contrast(opts.contrast ?? 1, true);
        return;
      }
      case "colourblind": {
        const cm = filter as ColorMatrixFilter;
        cm.reset();
        const [
          m0 = 1,
          m1 = 0,
          m2 = 0,
          m3 = 0,
          m4 = 1,
          m5 = 0,
          m6 = 0,
          m7 = 0,
          m8 = 1,
        ] = COLOURBLIND_MATRICES[opts.mode ?? "deuteranopia"];
        // ColorMatrixFilter.matrix is a 4x5 row-major matrix (RGBA + offset);
        // embed PostProcessSystem's 3x3 CVD simulation matrix into its RGB
        // block, leaving alpha and offsets untouched — the same coefficients
        // cssFilterForLayer()'s SVG feColorMatrix fallback uses.
        cm.matrix = [
          m0,
          m1,
          m2,
          0,
          0,
          m3,
          m4,
          m5,
          0,
          0,
          m6,
          m7,
          m8,
          0,
          0,
          0,
          0,
          0,
          1,
          0,
        ];
        return;
      }
      case "rain-glass": {
        const rain = filter as RainGlassFilter;
        const rainOptions: RainGlassFilterOptions = {};
        if (opts.intensity !== undefined)
          rainOptions.intensity = opts.intensity;
        if (opts.dropletSize !== undefined)
          rainOptions.dropletSize = opts.dropletSize;
        if (opts.dropletSpeed !== undefined)
          rainOptions.dropletSpeed = opts.dropletSpeed;
        if (opts.streakAmount !== undefined)
          rainOptions.streakAmount = opts.streakAmount;
        rain.setOptions(rainOptions);
        rain.setResolution(
          this._renderer?.width ?? 1,
          this._renderer?.height ?? 1,
        );
        return;
      }
      default:
        return;
    }
  }

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
    viewport: { x: number; y: number; width: number; height: number },
  ): void {
    if (this._renderer === null) return;
    const width = Math.max(1, Math.round(viewport.width));
    const height = Math.max(1, Math.round(viewport.height));
    const reference = {
      x: viewport.x + viewport.width / 2,
      y: viewport.y + viewport.height / 2,
    };
    const lights = lighting.collectLights(scene, reference);

    if (
      this._lightMapTexture === null ||
      this._lightMapTexture.width !== width ||
      this._lightMapTexture.height !== height
    ) {
      this._lightMapTexture?.destroy(true);
      this._lightMapTexture = RenderTexture.create({ width, height });
    }
    this._lightMapContainer ??= new Container();
    this._lightMapContainer.removeChildren();
    for (const light of lights) {
      this._lightMapContainer.addChild(
        buildLightGraphics(light, viewport.x, viewport.y),
      );
    }
    this._renderer.render({
      container: this._lightMapContainer,
      target: this._lightMapTexture,
      clearColor: 0x000000,
    });

    if (this._lightingFilter === null) {
      this._lightingFilter = new SimpleLightmapFilter({
        lightMap: this._lightMapTexture,
        color: lighting.ambient.colour,
        alpha: lighting.ambient.level,
      });
      this._lightingLayerId = layerId;
      this.addLayerShaderFilter(layerId, this._lightingFilter);
      return;
    }

    this._lightingFilter.lightMap = this._lightMapTexture;
    this._lightingFilter.color = lighting.ambient.colour;
    this._lightingFilter.alpha = lighting.ambient.level;
    if (this._lightingLayerId !== layerId) {
      if (this._lightingLayerId !== null) {
        this.removeLayerShaderFilter(
          this._lightingLayerId,
          this._lightingFilter,
        );
      }
      this.addLayerShaderFilter(layerId, this._lightingFilter);
      this._lightingLayerId = layerId;
    }
  }

  /** Detach and destroy whatever `syncLighting()` built. Call from scene teardown if a scene turns lighting off entirely. */
  clearLighting(): void {
    if (this._lightingFilter !== null && this._lightingLayerId !== null) {
      this.removeLayerShaderFilter(this._lightingLayerId, this._lightingFilter);
      this._lightingFilter.destroy();
    }
    this._lightingFilter = null;
    this._lightingLayerId = null;
    this._lightMapTexture?.destroy(true);
    this._lightMapTexture = null;
    this._lightMapContainer?.destroy({ children: true });
    this._lightMapContainer = null;
  }

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
  renderMultiCamera(viewports: readonly CameraViewport[]): void {
    if (this._renderer === null || this._stage === null) return;
    this.syncLayerVisibility();
    this.syncLayerOffsets();

    // Preserve whatever CameraSystem.update() last wrote to `_stage` so this
    // opt-in path can never leak into the ordinary single-camera render().
    const savedX = this._stage.x;
    const savedY = this._stage.y;
    const savedScaleX = this._stage.scale.x;
    const savedScaleY = this._stage.scale.y;
    const savedRotation = this._stage.rotation;

    this._multiCameraCompositor ??= new Container();
    this._multiCameraCompositor.removeChildren();

    const seen = new Set<number>();
    for (const viewport of viewports) {
      seen.add(viewport.id);
      const width = Math.max(1, Math.round(viewport.viewWidth));
      const height = Math.max(1, Math.round(viewport.viewHeight));

      let texture = this._multiCameraTextures.get(viewport.id);
      if (
        texture === undefined ||
        texture.width !== width ||
        texture.height !== height
      ) {
        texture?.destroy(true);
        texture = RenderTexture.create({ width, height });
        this._multiCameraTextures.set(viewport.id, texture);
      }

      this._stage.x = -viewport.x;
      this._stage.y = -viewport.y;
      this._stage.scale.set(viewport.zoom);
      this._stage.rotation = viewport.rotation;

      this._renderer.render({
        container: this._stage,
        target: texture,
        clearColor: 0x000000,
      });

      let sprite = this._multiCameraSprites.get(viewport.id);
      if (sprite === undefined) {
        sprite = new Sprite(texture);
        this._multiCameraSprites.set(viewport.id, sprite);
      } else if (sprite.texture !== texture) {
        sprite.texture = texture;
      }
      sprite.position.set(viewport.screenX, viewport.screenY);
      sprite.width = viewport.screenWidth;
      sprite.height = viewport.screenHeight;
      this._multiCameraCompositor.addChild(sprite);
    }

    // Drop cached textures/sprites for viewport ids no longer active.
    for (const id of [...this._multiCameraTextures.keys()]) {
      if (!seen.has(id)) {
        this._multiCameraTextures.get(id)?.destroy(true);
        this._multiCameraTextures.delete(id);
        this._multiCameraSprites.delete(id);
      }
    }

    this._stage.x = savedX;
    this._stage.y = savedY;
    this._stage.scale.set(savedScaleX, savedScaleY);
    this._stage.rotation = savedRotation;

    this._renderer.render(this._multiCameraCompositor);
  }

  get renderer(): Renderer {
    if (this._renderer === null)
      throw new Error("RenderSystem not initialized");
    return this._renderer;
  }

  get stage(): Container {
    if (this._stage === null) throw new Error("RenderSystem not initialized");
    return this._stage;
  }

  get canvas(): HTMLCanvasElement {
    if (this._canvas === null) throw new Error("RenderSystem not initialized");
    return this._canvas;
  }

  /**
   * Camera-independent overlay container — a sibling of `stage`, never a
   * descendant of it, so `CameraSystem.attach(stage)`'s pan/zoom/rotate
   * writes to `stage` never reach anything mounted here. See `_guiStage`'s
   * doc comment.
   */
  get guiStage(): Container {
    if (this._guiStage === null)
      throw new Error("RenderSystem not initialized");
    return this._guiStage;
  }

  render(): void {
    if (this._renderer === null || this._root === null) return;
    // Sync visibility each frame so setVisible() changes are reflected.
    this.syncLayerVisibility();
    this.syncLayerOffsets();
    this._renderer.render(this._root);
  }

  resize(width: number, height: number): void {
    this._renderer?.resize(width, height);
  }

  destroy(): void {
    for (const entry of this._postProcessFilters.values()) {
      entry.filter.destroy();
    }
    this._postProcessFilters.clear();
    this.clearLighting();
    for (const texture of this._multiCameraTextures.values()) {
      texture.destroy(true);
    }
    this._multiCameraTextures.clear();
    this._multiCameraSprites.clear();
    this._multiCameraCompositor?.destroy({ children: true });
    this._multiCameraCompositor = null;
    this._layerContainers.clear();
    this._defaultContainer = null;
    this._layerSystem = null;
    this._renderer?.destroy();
    this._renderer = null;
    this._stage = null;
    this._guiStage = null;
    this._root = null;
    this._canvas = null;
  }
}

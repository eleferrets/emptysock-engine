import {
  autoDetectRenderer,
  BlurFilter,
  ColorMatrixFilter,
  Container,
  type Filter,
  type Renderer,
} from "pixi.js";
import { OutlineFilter } from "pixi-filters";
import type { LayerSystem } from "./LayerSystem.js";
import { gpuTierRenderDefaults } from "./ViewportSystem.js";
import type { GPUTier } from "../core/GPUTier.js";
import {
  COLOURBLIND_MATRICES,
  type LayerFilterOptions,
  type LayerFilterType,
  type PostProcessSystem,
} from "./PostProcessSystem.js";

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
      default:
        return;
    }
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

  render(): void {
    if (this._renderer === null || this._stage === null) return;
    // Sync visibility each frame so setVisible() changes are reflected.
    this.syncLayerVisibility();
    this._renderer.render(this._stage);
  }

  resize(width: number, height: number): void {
    this._renderer?.resize(width, height);
  }

  destroy(): void {
    for (const entry of this._postProcessFilters.values()) {
      entry.filter.destroy();
    }
    this._postProcessFilters.clear();
    this._layerContainers.clear();
    this._defaultContainer = null;
    this._layerSystem = null;
    this._renderer?.destroy();
    this._renderer = null;
    this._stage = null;
    this._canvas = null;
  }
}

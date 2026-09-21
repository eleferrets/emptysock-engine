import {
  autoDetectRenderer,
  Container,
  type Filter,
  type Renderer,
} from "pixi.js";
import type { LayerSystem } from "./LayerSystem.js";
import { gpuTierRenderDefaults } from "./ViewportSystem.js";
import type { GPUTier } from "../core/GPUTier.js";

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
    container.filters = [...container.filters, filter];
  }

  /** Detach a previously attached shader filter from a layer's container. */
  removeLayerShaderFilter(layerName: string, filter: Filter): void {
    const container = this.getLayerContainer(layerName);
    container.filters = container.filters.filter((f) => f !== filter);
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
    this._layerContainers.clear();
    this._defaultContainer = null;
    this._layerSystem = null;
    this._renderer?.destroy();
    this._renderer = null;
    this._stage = null;
    this._canvas = null;
  }
}

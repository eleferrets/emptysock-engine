import { Container, type Filter, type Renderer } from "pixi.js";
import type { LayerSystem } from "./LayerSystem.js";
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
export declare class RenderSystem {
  private _renderer;
  private _stage;
  private _canvas;
  private _layerSystem;
  /** Per-layer PixiJS containers keyed by layer name. */
  private _layerContainers;
  /** Fallback single-container used when no LayerSystem is set. */
  private _defaultContainer;
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
  get renderer(): Renderer;
  get stage(): Container;
  get canvas(): HTMLCanvasElement;
  render(): void;
  resize(width: number, height: number): void;
  destroy(): void;
}

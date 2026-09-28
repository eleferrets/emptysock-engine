import type { GPUTier } from "@emptysock/types";
import type { CameraSystem } from "./CameraSystem.js";
export type ScaleMode = "fit" | "fill" | "stretch";
/**
 * The minimal shape ViewportSystem needs from a render target. Both
 * RenderSystem and RenderPipeline satisfy this structurally — pass either.
 */
export interface ResizableRenderTarget {
  resize(width: number, height: number): void;
  readonly canvas: HTMLCanvasElement;
}
export interface ViewportConfig {
  /** Design (logical) resolution the game is authored against. */
  designWidth: number;
  designHeight: number;
  /** How the design resolution maps onto the actual container size. */
  scaleMode: ScaleMode;
  /** Element that bounds the canvas. Falls back to window dimensions when absent. */
  container?: HTMLElement;
}
export interface ViewportSize {
  /** The rendered canvas size in CSS pixels. */
  width: number;
  height: number;
  /** Offset applied for letterboxing/pillarboxing (fit mode) in CSS pixels. */
  offsetX: number;
  offsetY: number;
  /** Scale factor from design resolution to rendered size. */
  scale: number;
}
export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
/**
 * Computes the letterboxed/filled/stretched viewport size for a design
 * resolution against an available container size. Pure math — safe to unit
 * test without any DOM.
 */
export declare function computeViewportSize(
  designWidth: number,
  designHeight: number,
  availableWidth: number,
  availableHeight: number,
  scaleMode: ScaleMode,
): ViewportSize;
/**
 * Reads GPU-tier-appropriate default RenderSystem init options.
 * "potato" and "low" tiers disable antialiasing and cap devicePixelRatio at 1
 * to protect frame time on weak GPUs. "mid" and above keep antialiasing and
 * use the full device pixel ratio (capped at 2 to bound fill-rate cost on
 * ultra-high-DPI mobile panels).
 */
export declare function gpuTierRenderDefaults(
  tier: GPUTier,
  devicePixelRatio?: number,
): {
  antialias: boolean;
  resolution: number;
};
/**
 * Owns automatic viewport handling: design-resolution scaling (fit / fill /
 * stretch), resize + orientation-change listening, and safe-area-inset
 * exposure. Feeds resize() on the render target (RenderSystem or, typically,
 * RenderPipeline — the batteries-included rendering path) and
 * CameraSystem.setViewSize() so the renderer and camera never go stale after
 * the container changes size.
 *
 * Safe in Node/Vitest: every DOM access is guarded the same way
 * RenderSystem guards `window.devicePixelRatio` and WindowSystem guards
 * `document`/`window` at the call site (see CLAUDE.md's Tauri-detection
 * pattern — the same style applies to any host-only API).
 */
export declare class ViewportSystem {
  private _config;
  private _renderTarget;
  private _cameraSystem;
  private _resizeObserver;
  private _windowResizeHandler;
  private _orientationHandler;
  private _lastSize;
  /**
   * Wire the systems that should be kept in sync on resize, and start
   * listening. Call once during scene/engine setup.
   */
  init(
    config: Partial<ViewportConfig>,
    systems?: {
      renderTarget?: ResizableRenderTarget;
      cameraSystem?: CameraSystem;
    },
  ): void;
  /** Recompute the letterboxed size and push it to RenderSystem + CameraSystem. */
  recompute(): ViewportSize;
  get size(): Readonly<ViewportSize>;
  get config(): Readonly<ViewportConfig>;
  setScaleMode(mode: ScaleMode): void;
  setDesignResolution(width: number, height: number): void;
  /**
   * Reads env(safe-area-inset-*) via the standard CSS-custom-property probe
   * technique: a hidden element with padding set from the env() values, whose
   * computed styles are then read back in pixels. Returns all-zero insets
   * outside a browser context or when the platform does not support them.
   */
  getSafeAreaInsets(): SafeAreaInsets;
  destroy(): void;
  private _availableSize;
  private _applyCanvasStyle;
  private _installListeners;
}

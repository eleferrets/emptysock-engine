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

const DEFAULT_CONFIG: ViewportConfig = {
  designWidth: 1280,
  designHeight: 720,
  scaleMode: "fit",
};

/** Minimal shape of a ResizeObserver — avoids depending on DOM lib types at the engine boundary. */
interface ResizeObserverLike {
  observe(target: Element): void;
  disconnect(): void;
}

interface ResizeObserverCtor {
  new (callback: () => void): ResizeObserverLike;
}

function hasWindow(): boolean {
  return typeof window !== "undefined";
}

function hasDocument(): boolean {
  return typeof document !== "undefined";
}

/**
 * Computes the letterboxed/filled/stretched viewport size for a design
 * resolution against an available container size. Pure math — safe to unit
 * test without any DOM.
 */
export function computeViewportSize(
  designWidth: number,
  designHeight: number,
  availableWidth: number,
  availableHeight: number,
  scaleMode: ScaleMode,
): ViewportSize {
  if (
    designWidth <= 0 ||
    designHeight <= 0 ||
    availableWidth <= 0 ||
    availableHeight <= 0
  ) {
    return { width: 0, height: 0, offsetX: 0, offsetY: 0, scale: 0 };
  }

  if (scaleMode === "stretch") {
    return {
      width: availableWidth,
      height: availableHeight,
      offsetX: 0,
      offsetY: 0,
      scale: 1,
    };
  }

  const scaleX = availableWidth / designWidth;
  const scaleY = availableHeight / designHeight;
  // "fit" letterboxes (never crops — use the smaller scale).
  // "fill" cover-crops (never letterboxes — use the larger scale).
  const scale =
    scaleMode === "fill" ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);

  const width = designWidth * scale;
  const height = designHeight * scale;

  return {
    width,
    height,
    offsetX: (availableWidth - width) / 2,
    offsetY: (availableHeight - height) / 2,
    scale,
  };
}

/**
 * Reads GPU-tier-appropriate default RenderSystem init options.
 * "potato" and "low" tiers disable antialiasing and cap devicePixelRatio at 1
 * to protect frame time on weak GPUs. "mid" and above keep antialiasing and
 * use the full device pixel ratio (capped at 2 to bound fill-rate cost on
 * ultra-high-DPI mobile panels).
 */
export function gpuTierRenderDefaults(
  tier: GPUTier,
  devicePixelRatio: number = 1,
): { antialias: boolean; resolution: number } {
  switch (tier) {
    case "potato":
    case "low":
      return { antialias: false, resolution: 1 };
    case "mid":
      return { antialias: true, resolution: Math.min(devicePixelRatio, 1.5) };
    case "high":
    case "ultra":
    default:
      return { antialias: true, resolution: Math.min(devicePixelRatio, 2) };
  }
}

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
export class ViewportSystem {
  private _config: ViewportConfig = { ...DEFAULT_CONFIG };
  private _renderTarget: ResizableRenderTarget | null = null;
  private _cameraSystem: CameraSystem | null = null;
  private _resizeObserver: ResizeObserverLike | null = null;
  private _windowResizeHandler: (() => void) | null = null;
  private _orientationHandler: (() => void) | null = null;
  private _lastSize: ViewportSize = {
    width: 0,
    height: 0,
    offsetX: 0,
    offsetY: 0,
    scale: 0,
  };

  /**
   * Wire the systems that should be kept in sync on resize, and start
   * listening. Call once during scene/engine setup.
   */
  init(
    config: Partial<ViewportConfig>,
    systems: {
      renderTarget?: ResizableRenderTarget;
      cameraSystem?: CameraSystem;
    } = {},
  ): void {
    this._config = { ...DEFAULT_CONFIG, ...config };
    this._renderTarget = systems.renderTarget ?? null;
    this._cameraSystem = systems.cameraSystem ?? null;

    this._installListeners();
    this.recompute();
  }

  /** Recompute the letterboxed size and push it to RenderSystem + CameraSystem. */
  recompute(): ViewportSize {
    const { width: availW, height: availH } = this._availableSize();
    const size = computeViewportSize(
      this._config.designWidth,
      this._config.designHeight,
      availW,
      availH,
      this._config.scaleMode,
    );
    this._lastSize = size;

    this._applyCanvasStyle(size);

    if (size.width > 0 && size.height > 0) {
      this._renderTarget?.resize(size.width, size.height);
      this._cameraSystem?.setViewSize(
        this._config.designWidth,
        this._config.designHeight,
      );
    }

    return size;
  }

  get size(): Readonly<ViewportSize> {
    return this._lastSize;
  }

  get config(): Readonly<ViewportConfig> {
    return this._config;
  }

  setScaleMode(mode: ScaleMode): void {
    this._config.scaleMode = mode;
    this.recompute();
  }

  setDesignResolution(width: number, height: number): void {
    this._config.designWidth = width;
    this._config.designHeight = height;
    this.recompute();
  }

  /**
   * Reads env(safe-area-inset-*) via the standard CSS-custom-property probe
   * technique: a hidden element with padding set from the env() values, whose
   * computed styles are then read back in pixels. Returns all-zero insets
   * outside a browser context or when the platform does not support them.
   */
  getSafeAreaInsets(): SafeAreaInsets {
    if (!hasDocument()) {
      return { top: 0, right: 0, bottom: 0, left: 0 };
    }

    const probe = document.createElement("div");
    probe.style.position = "fixed";
    probe.style.pointerEvents = "none";
    probe.style.visibility = "hidden";
    probe.style.paddingTop = "env(safe-area-inset-top, 0px)";
    probe.style.paddingRight = "env(safe-area-inset-right, 0px)";
    probe.style.paddingBottom = "env(safe-area-inset-bottom, 0px)";
    probe.style.paddingLeft = "env(safe-area-inset-left, 0px)";
    document.body.appendChild(probe);

    const computed = window.getComputedStyle(probe);
    const insets: SafeAreaInsets = {
      top: parseFloat(computed.paddingTop) || 0,
      right: parseFloat(computed.paddingRight) || 0,
      bottom: parseFloat(computed.paddingBottom) || 0,
      left: parseFloat(computed.paddingLeft) || 0,
    };

    document.body.removeChild(probe);
    return insets;
  }

  destroy(): void {
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;

    if (hasWindow()) {
      if (this._windowResizeHandler) {
        window.removeEventListener("resize", this._windowResizeHandler);
      }
      if (this._orientationHandler) {
        window.removeEventListener(
          "orientationchange",
          this._orientationHandler,
        );
      }
    }
    this._windowResizeHandler = null;
    this._orientationHandler = null;
    this._renderTarget = null;
    this._cameraSystem = null;
  }

  // ─── private helpers ───────────────────────────────────────────────────────

  private _availableSize(): { width: number; height: number } {
    const container = this._config.container;
    if (container) {
      return { width: container.clientWidth, height: container.clientHeight };
    }
    if (hasWindow()) {
      return { width: window.innerWidth, height: window.innerHeight };
    }
    // Node/Vitest — fall back to the design resolution so recompute() is a no-op.
    return {
      width: this._config.designWidth,
      height: this._config.designHeight,
    };
  }

  private _applyCanvasStyle(size: ViewportSize): void {
    if (!hasDocument() || !this._renderTarget) return;
    let canvas: HTMLCanvasElement;
    try {
      canvas = this._renderTarget.canvas;
    } catch {
      return; // render target not initialized yet
    }
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
    canvas.style.position = "absolute";
    canvas.style.left = `${size.offsetX}px`;
    canvas.style.top = `${size.offsetY}px`;
  }

  private _installListeners(): void {
    if (!hasWindow()) return;

    // Prefer ResizeObserver on the container element when one is available
    // (matches viewport changes even without a window resize, e.g. a panel
    // resize inside the IDE preview). Fall back to window "resize", the same
    // pattern InputSystem uses for its own window listeners.
    const ResizeObserverImpl = (
      window as unknown as { ResizeObserver?: ResizeObserverCtor }
    ).ResizeObserver;

    if (this._config.container && ResizeObserverImpl) {
      this._resizeObserver = new ResizeObserverImpl(() => this.recompute());
      this._resizeObserver.observe(this._config.container);
    } else {
      this._windowResizeHandler = () => this.recompute();
      window.addEventListener("resize", this._windowResizeHandler);
    }

    this._orientationHandler = () => this.recompute();
    window.addEventListener("orientationchange", this._orientationHandler);
  }
}

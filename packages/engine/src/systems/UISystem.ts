// UI system — manages the Widget tree and dispatches input to it.
// The previous UIComponent API has been removed; use the Widget hierarchy instead.
// UISystem is instantiated per-scene (via Scene.ui) rather than as a global singleton.

import type { ImageLoader, IUIRenderer } from "@emptysock/types";
import type { Widget } from "../ui/Widget.js";

export class UISystem {
  private readonly _roots: Widget[] = [];
  private _imageLoader: ImageLoader | null = null;
  private readonly _imageCache: Map<string, ImageBitmap> = new Map();
  private readonly _imagePending: Set<string> = new Set();

  /**
   * Inject an ImageLoader so that ImageWidget components resolve their source
   * instead of rendering a grey placeholder. Call this once at game init.
   */
  setImageLoader(loader: ImageLoader | null): void {
    this._imageLoader = loader;
  }

  /** Fetch a loaded image from the cache, kicking off a load if not present. */
  getImage(src: string): ImageBitmap | undefined {
    if (src.length === 0) return undefined;
    const cached = this._imageCache.get(src);
    if (cached !== undefined) return cached;
    if (this._imageLoader !== null && !this._imagePending.has(src)) {
      this._imagePending.add(src);
      this._imageLoader
        .load(src)
        .then((result: string | ImageBitmap) => {
          if (result instanceof ImageBitmap) {
            this._imageCache.set(src, result);
          }
          this._imagePending.delete(src);
        })
        .catch(() => {
          this._imagePending.delete(src);
        });
    }
    return undefined;
  }

  add(widget: Widget): void {
    this._roots.push(widget);
  }

  remove(widget: Widget): void {
    const idx = this._roots.indexOf(widget);
    if (idx !== -1) this._roots.splice(idx, 1);
  }

  get roots(): ReadonlyArray<Widget> {
    return this._roots;
  }

  clear(): void {
    this._roots.length = 0;
  }

  /**
   * Advance all active animations and update hover state.
   * Call once per frame before render(), passing delta-time in seconds.
   */
  update(
    dt: number,
    pointerX?: number,
    pointerY?: number,
    canvasWidth?: number,
    canvasHeight?: number,
  ): void {
    for (const w of this._roots) w._tick(dt);

    if (
      pointerX !== undefined &&
      pointerY !== undefined &&
      canvasWidth !== undefined &&
      canvasHeight !== undefined
    ) {
      this._updateHover(
        this._roots,
        pointerX,
        pointerY,
        canvasWidth,
        canvasHeight,
      );
    }
  }

  /** Hit-test and dispatch click to the topmost matching widget. */
  handleClick(
    x: number,
    y: number,
    canvasWidth: number,
    canvasHeight: number,
  ): boolean {
    const hit = this._findHit(this._roots, x, y, canvasWidth, canvasHeight);
    if (hit !== null) {
      if ("_lastPointerX" in hit) {
        (
          hit as { _lastPointerX: number; _lastPointerCW: number }
        )._lastPointerX = x;
        (
          hit as { _lastPointerX: number; _lastPointerCW: number }
        )._lastPointerCW = canvasWidth;
      }
      hit.triggerClick();
      return true;
    }
    return false;
  }

  /** Alias for handleClick — preferred name for pointer-down dispatch. */
  dispatchPointerDown(
    x: number,
    y: number,
    canvasWidth: number,
    canvasHeight: number,
  ): boolean {
    return this.handleClick(x, y, canvasWidth, canvasHeight);
  }

  /** Update hover state given the current pointer position. */
  handlePointerMove(
    x: number,
    y: number,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    this._updateHover(this._roots, x, y, canvasWidth, canvasHeight);
  }

  /** Draw all root widgets to the given renderer. */
  render(ctx: IUIRenderer, canvasWidth: number, canvasHeight: number): void {
    for (const widget of this._roots) {
      widget.render(ctx, canvasWidth, canvasHeight);
    }
  }

  private _findHit(
    widgets: ReadonlyArray<Widget>,
    x: number,
    y: number,
    cw: number,
    ch: number,
  ): Widget | null {
    for (let i = widgets.length - 1; i >= 0; i--) {
      const w = widgets[i];
      if (w === undefined) continue;
      const child = this._findHit(w.children, x, y, cw, ch);
      if (child !== null) return child;
      if (w.contains(x, y, cw, ch)) return w;
    }
    return null;
  }

  /** Dispatch a pointer-up event (e.g. touch end or mouse button release). */
  dispatchPointerUp(
    x: number,
    y: number,
    canvasWidth: number,
    canvasHeight: number,
  ): boolean {
    return this.handleClick(x, y, canvasWidth, canvasHeight);
  }

  /** Release all ImageBitmap allocations and clear the widget tree. */
  destroy(): void {
    this.clear();
    for (const bitmap of this._imageCache.values()) {
      bitmap.close();
    }
    this._imageCache.clear();
    this._imagePending.clear();
    this._imageLoader = null;
  }

  private _updateHover(
    widgets: ReadonlyArray<Widget>,
    px: number,
    py: number,
    cw: number,
    ch: number,
  ): void {
    for (const w of widgets) {
      w._setHovered(w.contains(px, py, cw, ch));
      this._updateHover(w.children, px, py, cw, ch);
    }
  }
}

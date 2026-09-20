// UI system — manages the Widget tree and dispatches input to it.
// The previous UIComponent API has been removed; use the Widget hierarchy instead.
// UISystem is instantiated per-scene (via Scene.ui) rather than as a global singleton.

import type { ImageLoader, IUIRenderer } from "@emptysock/types";
import type { Widget } from "../ui/Widget.js";

/**
 * How far a pointer may move between press and release, in design-resolution
 * pixels, before the gesture is treated as a drag instead of a click. A drag
 * still fires `release` but not `click`.
 */
const CLICK_DRAG_THRESHOLD = 6;

interface PressState {
  widget: Widget;
  startX: number;
  startY: number;
  dragging: boolean;
}

export class UISystem {
  private readonly _roots: Widget[] = [];
  private _imageLoader: ImageLoader | null = null;
  private readonly _imageCache: Map<string, ImageBitmap> = new Map();
  private readonly _imagePending: Set<string> = new Set();

  /**
   * Uniform scale applied when resolving widget positions/sizes, intended to
   * be fed by a ViewportSystem (canvas-size / design-resolution ratio) once
   * one exists. Defaults to 1 (no scaling) so existing callers are unaffected.
   */
  private _scale = 1;

  /** In-flight presses, keyed by pointer id (mouse uses id 0 by convention). */
  private readonly _presses: Map<number, PressState> = new Map();

  /**
   * Set the canvas-to-design-resolution scale factor used by widget
   * positioning, sizing, and hit-testing. Intended to be fed by a
   * ViewportSystem (canvas size / design resolution); applied to every root
   * widget's tree immediately.
   */
  setScale(scale: number): void {
    this._scale = scale > 0 ? scale : 1;
    for (const w of this._roots) this._applyScale(w);
  }

  private _applyScale(widget: Widget): void {
    widget.uiScale = this._scale;
    for (const child of widget.children) this._applyScale(child);
  }

  get scale(): number {
    return this._scale;
  }

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
    if (this._scale !== 1) this._applyScale(widget);
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

  /**
   * Legacy convenience: hit-test and immediately trigger a click on the
   * topmost matching widget, with no press/drag distinction. Prefer
   * `dispatchPointerDown` + `dispatchPointerUp` for real touch/mouse
   * semantics; this remains for callers that only need a single-shot click.
   */
  handleClick(
    x: number,
    y: number,
    canvasWidth: number,
    canvasHeight: number,
  ): boolean {
    const hit = this._findHit(this._roots, x, y, canvasWidth, canvasHeight);
    if (hit !== null) {
      this._syncSliderPointer(hit, x, canvasWidth);
      hit.triggerClick();
      return true;
    }
    return false;
  }

  private _syncSliderPointer(
    hit: Widget,
    x: number,
    canvasWidth: number,
  ): void {
    if ("_lastPointerX" in hit) {
      const slider = hit as unknown as {
        _lastPointerX: number;
        _lastPointerCW: number;
      };
      slider._lastPointerX = x;
      slider._lastPointerCW = canvasWidth;
    }
  }

  /**
   * Begin a press on the topmost widget under (x, y). Does not fire `click`
   * immediately — the click fires on `dispatchPointerUp` only if the pointer
   * did not move past the drag threshold, giving real press/drag/release
   * semantics for both mouse and touch instead of firing a click on down.
   * `pointerId` distinguishes simultaneous multi-touch presses (default 0
   * for a single mouse pointer).
   */
  dispatchPointerDown(
    x: number,
    y: number,
    canvasWidth: number,
    canvasHeight: number,
    pointerId = 0,
  ): boolean {
    const hit = this._findHit(this._roots, x, y, canvasWidth, canvasHeight);
    if (hit === null) return false;
    this._syncSliderPointer(hit, x, canvasWidth);
    this._presses.set(pointerId, {
      widget: hit,
      startX: x,
      startY: y,
      dragging: false,
    });
    return true;
  }

  /**
   * Update an in-flight press's position. Once the pointer has moved past
   * `CLICK_DRAG_THRESHOLD` from its start point, the press is marked as a
   * drag and will not fire `click` on release.
   */
  dispatchPointerDrag(x: number, y: number, pointerId = 0): void {
    const press = this._presses.get(pointerId);
    if (press === undefined) return;
    const dist = Math.hypot(x - press.startX, y - press.startY);
    if (dist > CLICK_DRAG_THRESHOLD) press.dragging = true;
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

  /**
   * Complete a press started with `dispatchPointerDown`. Fires `click` on the
   * pressed widget only if it was not marked as a drag (see
   * `dispatchPointerDrag`) and the release still lands on that same widget's
   * bounds — this is the real release semantics that `handleClick` alone
   * cannot express, since it always fires unconditionally on down.
   */
  dispatchPointerUp(
    x: number,
    y: number,
    canvasWidth: number,
    canvasHeight: number,
    pointerId = 0,
  ): boolean {
    const press = this._presses.get(pointerId);
    this._presses.delete(pointerId);
    if (press === undefined) return false;
    if (press.dragging) return false;
    if (!press.widget.contains(x, y, canvasWidth, canvasHeight)) return false;
    press.widget.triggerClick();
    return true;
  }

  /** Abort an in-flight press without firing `click` (e.g. pointercancel). */
  cancelPointer(pointerId = 0): void {
    this._presses.delete(pointerId);
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

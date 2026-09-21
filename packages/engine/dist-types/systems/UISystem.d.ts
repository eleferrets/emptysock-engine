import type { ImageLoader, IUIRenderer } from "@emptysock/types";
import type { Widget } from "../ui/Widget.js";
export declare class UISystem {
  private readonly _roots;
  private _imageLoader;
  private readonly _imageCache;
  private readonly _imagePending;
  /**
   * Uniform scale applied when resolving widget positions/sizes, intended to
   * be fed by a ViewportSystem (canvas-size / design-resolution ratio) once
   * one exists. Defaults to 1 (no scaling) so existing callers are unaffected.
   */
  private _scale;
  /** In-flight presses, keyed by pointer id (mouse uses id 0 by convention). */
  private readonly _presses;
  /**
   * Set the canvas-to-design-resolution scale factor used by widget
   * positioning, sizing, and hit-testing. Intended to be fed by a
   * ViewportSystem (canvas size / design resolution); applied to every root
   * widget's tree immediately.
   */
  setScale(scale: number): void;
  private _applyScale;
  get scale(): number;
  /**
   * Inject an ImageLoader so that ImageWidget components resolve their source
   * instead of rendering a grey placeholder. Call this once at game init.
   */
  setImageLoader(loader: ImageLoader | null): void;
  /** Fetch a loaded image from the cache, kicking off a load if not present. */
  getImage(src: string): ImageBitmap | undefined;
  add(widget: Widget): void;
  remove(widget: Widget): void;
  get roots(): ReadonlyArray<Widget>;
  clear(): void;
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
  ): void;
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
  ): boolean;
  private _syncSliderPointer;
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
    pointerId?: number,
  ): boolean;
  /**
   * Update an in-flight press's position. Once the pointer has moved past
   * `CLICK_DRAG_THRESHOLD` from its start point, the press is marked as a
   * drag and will not fire `click` on release.
   */
  dispatchPointerDrag(x: number, y: number, pointerId?: number): void;
  /** Update hover state given the current pointer position. */
  handlePointerMove(
    x: number,
    y: number,
    canvasWidth: number,
    canvasHeight: number,
  ): void;
  /** Draw all root widgets to the given renderer. */
  render(ctx: IUIRenderer, canvasWidth: number, canvasHeight: number): void;
  private _findHit;
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
    pointerId?: number,
  ): boolean;
  /** Abort an in-flight press without firing `click` (e.g. pointercancel). */
  cancelPointer(pointerId?: number): void;
  /** Release all ImageBitmap allocations and clear the widget tree. */
  destroy(): void;
  private _updateHover;
}

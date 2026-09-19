import type { ImageLoader, IUIRenderer } from "@emptysock/types";
import type { Widget } from "../ui/Widget.js";
export declare class UISystem {
  private readonly _roots;
  private _imageLoader;
  private readonly _imageCache;
  private readonly _imagePending;
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
  /** Hit-test and dispatch click to the topmost matching widget. */
  handleClick(
    x: number,
    y: number,
    canvasWidth: number,
    canvasHeight: number,
  ): boolean;
  /** Alias for handleClick — preferred name for pointer-down dispatch. */
  dispatchPointerDown(
    x: number,
    y: number,
    canvasWidth: number,
    canvasHeight: number,
  ): boolean;
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
  /** Dispatch a pointer-up event (e.g. touch end or mouse button release). */
  dispatchPointerUp(
    x: number,
    y: number,
    canvasWidth: number,
    canvasHeight: number,
  ): boolean;
  /** Release all ImageBitmap allocations and clear the widget tree. */
  destroy(): void;
  private _updateHover;
}

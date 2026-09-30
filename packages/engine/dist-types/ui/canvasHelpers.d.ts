import type { IUIRenderer } from "@emptysock/types";
/**
 * Minimum recommended interactive-widget dimension (in design-resolution
 * pixels), per the iOS Human Interface Guidelines' 44pt touch-target
 * recommendation.
 */
export declare const MIN_INTERACTIVE_SIZE = 44;
/**
 * Warn (once per call site) if a button-like widget's configured size falls
 * below `MIN_INTERACTIVE_SIZE`. Never throws — this is UX guidance, not a
 * hard constraint, since some UIs intentionally use small controls. No-op
 * outside dev builds with a console available (guards the engine
 * environment boundary — this file must still run under Node/Vitest).
 */
export declare function warnIfBelowMinTouchTarget(
  label: string,
  width: number,
  height: number,
): void;
/** Draws a rounded rectangle path on `ctx`, falling back to a manual arc-based path if `roundRect` isn't available on the host canvas context. */
export declare function widgetRoundRect(
  ctx: IUIRenderer,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void;
/**
 * Adds `drawImageRegion` to a Canvas2D context so `UISystem` can draw bitmap
 * fonts: a region blit is the nine-argument form of `drawImage`, which every
 * `CanvasRenderingContext2D` already has. The engine imports no DOM types, so
 * this only forwards the call; pass a real 2D context (or one with the same
 * nine-argument `drawImage`). Every other member is forwarded to `ctx`.
 */
export declare function withImageRegion<T extends IUIRenderer>(ctx: T): T;

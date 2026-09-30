import type { IUIRenderer } from "@emptysock/types";

/**
 * Minimum recommended interactive-widget dimension (in design-resolution
 * pixels), per the iOS Human Interface Guidelines' 44pt touch-target
 * recommendation.
 */
export const MIN_INTERACTIVE_SIZE = 44;

/**
 * Warn (once per call site) if a button-like widget's configured size falls
 * below `MIN_INTERACTIVE_SIZE`. Never throws — this is UX guidance, not a
 * hard constraint, since some UIs intentionally use small controls. No-op
 * outside dev builds with a console available (guards the engine
 * environment boundary — this file must still run under Node/Vitest).
 */
export function warnIfBelowMinTouchTarget(
  label: string,
  width: number,
  height: number,
): void {
  if (typeof console === "undefined" || typeof console.warn !== "function") {
    return;
  }
  if (width < MIN_INTERACTIVE_SIZE || height < MIN_INTERACTIVE_SIZE) {
    console.warn(
      `[EmptySock] ${label} is ${width}x${height}px, below the recommended ` +
        `${MIN_INTERACTIVE_SIZE}x${MIN_INTERACTIVE_SIZE}px minimum touch target.`,
    );
  }
}

/** Draws a rounded rectangle path on `ctx`, falling back to a manual arc-based path if `roundRect` isn't available on the host canvas context. */
export function widgetRoundRect(
  ctx: IUIRenderer,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  if (r <= 0) {
    ctx.rect(x, y, w, h);
    return;
  }
  const rr = Math.min(r, w / 2, h / 2);
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, rr);
  } else {
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.arcTo(x + w, y, x + w, y + rr, rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
    ctx.lineTo(x + rr, y + h);
    ctx.arcTo(x, y + h, x, y + h - rr, rr);
    ctx.lineTo(x, y + rr);
    ctx.arcTo(x, y, x + rr, y, rr);
    ctx.closePath();
  }
}

/**
 * Adds `drawImageRegion` to a Canvas2D context so `UISystem` can draw bitmap
 * fonts: a region blit is the nine-argument form of `drawImage`, which every
 * `CanvasRenderingContext2D` already has. The engine imports no DOM types, so
 * this only forwards the call; pass a real 2D context (or one with the same
 * nine-argument `drawImage`). Every other member is forwarded to `ctx`.
 */
export function withImageRegion<T extends IUIRenderer>(ctx: T): T {
  const drawImageRegion = (
    image: object,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void => {
    (ctx as unknown as { drawImage(...args: unknown[]): void }).drawImage(
      image,
      sx,
      sy,
      sw,
      sh,
      dx,
      dy,
      dw,
      dh,
    );
  };
  return new Proxy(ctx, {
    get(target, prop) {
      if (prop === "drawImageRegion") return drawImageRegion;
      const value: unknown = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
    set(target, prop, value) {
      return Reflect.set(target, prop, value, target);
    },
  });
}

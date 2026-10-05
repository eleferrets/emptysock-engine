import type { EasingName } from "../easing.js";
/**
 * Hit-flash on a `Sprite`: paint the silhouette `color` at `amount` (0..1).
 * `SpriteFlashSystem` drives `amount` from `peak` down to 0 over `duration`
 * seconds; the render backend (today a pooled `ColorOverlayFilter` attached
 * only while `amount > 0`) reads `color`/`amount` and nothing else, so a
 * Mesh path can replace it without touching this component or the system.
 * Start a flash with `startSpriteFlash()`.
 */
export declare const SpriteFlash: import("../Component.js").ComponentDef<{
  /** Overlay colour, 0xRRGGBB. */
  color: number;
  /** Current overlay strength 0..1; written by the system, read by the renderer. */
  amount: number;
  /** Strength at the start of a flash. */
  peak: number;
  /** Flash length, seconds. */
  duration: number;
  /** Seconds since the flash started. */
  elapsed: number;
  /** Curve applied to progress; amount = peak * (1 - ease(progress)). */
  easing: EasingName;
  active: boolean;
}>;
export interface SpriteFlashOptions {
  color?: number;
  peak?: number;
  duration?: number;
  easing?: EasingName;
}
/** Begin (or restart) a flash on an existing `SpriteFlash` instance. */
export declare function startSpriteFlash(
  flash: {
    color: number;
    amount: number;
    peak: number;
    duration: number;
    elapsed: number;
    easing: EasingName;
    active: boolean;
  },
  options?: SpriteFlashOptions,
): void;

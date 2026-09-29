import { defineComponent } from "../Component.js";
import type { EasingName } from "../easing.js";

/**
 * Hit-flash on a `Sprite`: paint the silhouette `color` at `amount` (0..1).
 * `SpriteFlashSystem` drives `amount` from `peak` down to 0 over `duration`
 * seconds; the render backend (today a pooled `ColorOverlayFilter` attached
 * only while `amount > 0`) reads `color`/`amount` and nothing else, so a
 * Mesh path can replace it without touching this component or the system.
 * Start a flash with `startSpriteFlash()`.
 */
export const SpriteFlash = defineComponent(
  "SpriteFlash",
  () => ({
    /** Overlay colour, 0xRRGGBB. */
    color: 0xffffff,
    /** Current overlay strength 0..1; written by the system, read by the renderer. */
    amount: 0,
    /** Strength at the start of a flash. */
    peak: 1,
    /** Flash length, seconds. */
    duration: 0.12,
    /** Seconds since the flash started. */
    elapsed: 0,
    /** Curve applied to progress; amount = peak * (1 - ease(progress)). */
    easing: "linear" as EasingName,
    active: false as boolean,
  }),
  {
    schema: {
      color: { kind: "number" },
      amount: { kind: "number" },
      peak: { kind: "number" },
      duration: { kind: "number" },
      elapsed: { kind: "number" },
      easing: { kind: "string" },
      active: { kind: "boolean" },
    },
  },
);

export interface SpriteFlashOptions {
  color?: number;
  peak?: number;
  duration?: number;
  easing?: EasingName;
}

/** Begin (or restart) a flash on an existing `SpriteFlash` instance. */
export function startSpriteFlash(
  flash: {
    color: number;
    amount: number;
    peak: number;
    duration: number;
    elapsed: number;
    easing: EasingName;
    active: boolean;
  },
  options: SpriteFlashOptions = {},
): void {
  if (options.color !== undefined) flash.color = options.color;
  if (options.peak !== undefined) flash.peak = options.peak;
  if (options.duration !== undefined) flash.duration = options.duration;
  if (options.easing !== undefined) flash.easing = options.easing;
  flash.elapsed = 0;
  flash.amount = flash.peak;
  flash.active = flash.duration > 0 && flash.peak > 0;
  if (!flash.active) flash.amount = 0;
}

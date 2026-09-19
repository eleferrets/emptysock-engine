export type { EasingName } from "../core/easing.js";
export interface TweenOptions {
  duration: number;
  ease?: EasingName;
  delay?: number;
  onComplete?: () => void;
}
/** A cancelable handle returned by `TweenManager.to()`, `after()`, and `every()`. */
export interface TweenHandle {
  cancel(): void;
}
export declare class TweenManager {
  private readonly _tweens;
  private readonly _timers;
  /**
   * Animate numeric properties of `target` to the values in `props` over time.
   * Returns a handle whose `cancel()` stops the tween immediately.
   */
  to(
    target: Record<string, number>,
    props: Record<string, number>,
    options: TweenOptions,
  ): TweenHandle;
  /**
   * Call `fn` once after `seconds`. Returns a handle whose `cancel()` prevents
   * the callback from firing.
   */
  after(seconds: number, fn: () => void): TweenHandle;
  /**
   * Call `fn` repeatedly every `seconds`. Returns a handle whose `cancel()`
   * stops further calls.
   */
  every(seconds: number, fn: () => void): TweenHandle;
  update(deltaTime: number): void;
  killAll(): void;
  destroy(): void;
}

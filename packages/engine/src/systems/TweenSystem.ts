export type { EasingName } from "../core/easing.js";
import { ease } from "../core/easing.js";

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

interface TweenState {
  target: Record<string, number>;
  props: Record<string, { from: number; to: number }>;
  elapsed: number;
  delay: number;
  duration: number;
  easing: EasingName;
  onComplete: (() => void) | null;
  done: boolean;
}

interface TimerState {
  elapsed: number;
  delay: number;
  repeat: number;
  interval: number;
  fn: () => void;
  done: boolean;
}

export class TweenManager {
  private readonly _tweens: TweenState[] = [];
  private readonly _timers: TimerState[] = [];

  /**
   * Animate numeric properties of `target` to the values in `props` over time.
   * Returns a handle whose `cancel()` stops the tween immediately.
   */
  to(
    target: Record<string, number>,
    props: Record<string, number>,
    options: TweenOptions,
  ): TweenHandle {
    const fromProps: Record<string, { from: number; to: number }> = {};
    for (const key of Object.keys(props)) {
      const toVal = props[key];
      if (toVal === undefined) continue;
      fromProps[key] = { from: target[key] ?? 0, to: toVal };
    }
    const state: TweenState = {
      target,
      props: fromProps,
      elapsed: 0,
      delay: options.delay ?? 0,
      duration: options.duration,
      easing: options.ease ?? "linear",
      onComplete: options.onComplete ?? null,
      done: false,
    };
    this._tweens.push(state);
    return {
      cancel: () => {
        state.done = true;
      },
    };
  }

  /**
   * Call `fn` once after `seconds`. Returns a handle whose `cancel()` prevents
   * the callback from firing.
   */
  after(seconds: number, fn: () => void): TweenHandle {
    const state: TimerState = {
      elapsed: 0,
      delay: seconds,
      repeat: 0,
      interval: 0,
      fn,
      done: false,
    };
    this._timers.push(state);
    return {
      cancel: () => {
        state.done = true;
      },
    };
  }

  /**
   * Call `fn` repeatedly every `seconds`. Returns a handle whose `cancel()`
   * stops further calls.
   */
  every(seconds: number, fn: () => void): TweenHandle {
    const state: TimerState = {
      elapsed: 0,
      delay: seconds,
      repeat: -1,
      interval: seconds,
      fn,
      done: false,
    };
    this._timers.push(state);
    return {
      cancel: () => {
        state.done = true;
      },
    };
  }

  update(deltaTime: number): void {
    for (const tw of this._tweens) {
      if (tw.done) continue;
      tw.elapsed += deltaTime;
      if (tw.elapsed < tw.delay) continue;

      const t = Math.min(1, (tw.elapsed - tw.delay) / tw.duration);
      const e = ease(tw.easing, t);

      for (const [key, { from, to }] of Object.entries(tw.props)) {
        tw.target[key] = from + (to - from) * e;
      }

      if (t >= 1) {
        tw.done = true;
        tw.onComplete?.();
      }
    }

    for (let i = this._tweens.length - 1; i >= 0; i--) {
      if (this._tweens[i]?.done === true) this._tweens.splice(i, 1);
    }

    for (const timer of this._timers) {
      if (timer.done) continue;
      timer.elapsed += deltaTime;
      while (timer.elapsed >= timer.delay) {
        timer.elapsed -= timer.delay;
        timer.fn();
        if (timer.repeat === 0) {
          timer.done = true;
          break;
        }
        timer.delay = timer.interval;
      }
    }

    for (let i = this._timers.length - 1; i >= 0; i--) {
      if (this._timers[i]?.done === true) this._timers.splice(i, 1);
    }
  }

  killAll(): void {
    this._tweens.length = 0;
    this._timers.length = 0;
  }

  destroy(): void {
    this.killAll();
  }
}

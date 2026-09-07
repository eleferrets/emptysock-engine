export type EasingName =
  | "linear"
  | "sineIn"
  | "sineOut"
  | "sineInOut"
  | "quadIn"
  | "quadOut"
  | "quadInOut"
  | "cubicIn"
  | "cubicOut"
  | "cubicInOut"
  | "bounceOut"
  | "elasticOut";

function ease(name: EasingName, t: number): number {
  switch (name) {
    case "linear":
      return t;
    case "sineIn":
      return 1 - Math.cos((t * Math.PI) / 2);
    case "sineOut":
      return Math.sin((t * Math.PI) / 2);
    case "sineInOut":
      return -(Math.cos(Math.PI * t) - 1) / 2;
    case "quadIn":
      return t * t;
    case "quadOut":
      return 1 - (1 - t) * (1 - t);
    case "quadInOut":
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    case "cubicIn":
      return t * t * t;
    case "cubicOut":
      return 1 - Math.pow(1 - t, 3);
    case "cubicInOut":
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    case "bounceOut": {
      const n1 = 7.5625,
        d1 = 2.75;
      if (t < 1 / d1) return n1 * t * t;
      if (t < 2 / d1) {
        const t2 = t - 1.5 / d1;
        return n1 * t2 * t2 + 0.75;
      }
      if (t < 2.5 / d1) {
        const t2 = t - 2.25 / d1;
        return n1 * t2 * t2 + 0.9375;
      }
      const t3 = t - 2.625 / d1;
      return n1 * t3 * t3 + 0.984375;
    }
    case "elasticOut": {
      if (t === 0 || t === 1) return t;
      const c4 = (2 * Math.PI) / 3;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }
  }
}

export interface TweenOptions {
  duration: number;
  ease?: EasingName;
  delay?: number;
  onComplete?: () => void;
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

export class TweenManager {
  private readonly _tweens: TweenState[] = [];
  private readonly _timers: Array<{
    elapsed: number;
    delay: number;
    repeat: number;
    interval: number;
    fn: () => void;
    done: boolean;
  }> = [];

  to(
    target: Record<string, number>,
    props: Record<string, number>,
    options: TweenOptions,
  ): void {
    const fromProps: Record<string, { from: number; to: number }> = {};
    for (const key of Object.keys(props)) {
      const toVal = props[key];
      if (toVal === undefined) continue;
      fromProps[key] = { from: target[key] ?? 0, to: toVal };
    }
    this._tweens.push({
      target,
      props: fromProps,
      elapsed: 0,
      delay: options.delay ?? 0,
      duration: options.duration,
      easing: options.ease ?? "linear",
      onComplete: options.onComplete ?? null,
      done: false,
    });
  }

  after(seconds: number, fn: () => void): void {
    this._timers.push({
      elapsed: 0,
      delay: seconds,
      repeat: 0,
      interval: 0,
      fn,
      done: false,
    });
  }

  every(seconds: number, fn: () => void): void {
    this._timers.push({
      elapsed: 0,
      delay: seconds,
      repeat: -1,
      interval: seconds,
      fn,
      done: false,
    });
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

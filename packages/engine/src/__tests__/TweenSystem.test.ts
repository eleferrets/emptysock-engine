import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Tween, Timer } from '../systems/TweenSystem.js';

beforeEach(() => { Tween.killAll(); });

describe('Tween', () => {
  it('interpolates a property over time', () => {
    const obj: Record<string, number> = { x: 0 };
    Tween.to(obj, { x: 100 }, { duration: 1.0 });
    Tween.update(0.5);
    expect(obj['x']).toBeCloseTo(50, 0);
    Tween.update(0.5);
    expect(obj['x']).toBeCloseTo(100, 0);
  });

  it('calls onComplete when tween finishes', () => {
    const obj: Record<string, number> = { y: 0 };
    const cb = vi.fn();
    Tween.to(obj, { y: 1 }, { duration: 0.1, onComplete: cb });
    Tween.update(0.2);
    expect(cb).toHaveBeenCalledOnce();
  });

  it('respects delay before starting', () => {
    const obj: Record<string, number> = { v: 0 };
    Tween.to(obj, { v: 10 }, { duration: 0.5, delay: 0.5 });
    Tween.update(0.4);
    expect(obj['v']).toBe(0); // delay not elapsed
    Tween.update(0.6);
    expect(obj['v']).toBeGreaterThan(0);
  });
});

describe('Timer', () => {
  it('fires after() once after delay', () => {
    const fn = vi.fn();
    Timer.after(0.2, fn);
    Tween.update(0.1);
    expect(fn).not.toHaveBeenCalled();
    Tween.update(0.15);
    expect(fn).toHaveBeenCalledOnce();
    Tween.update(1.0);
    expect(fn).toHaveBeenCalledOnce(); // not called again
  });

  it('fires every() repeatedly', () => {
    const fn = vi.fn();
    Timer.every(0.1, fn);
    Tween.update(0.35);
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

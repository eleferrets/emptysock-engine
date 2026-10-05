import { describe, it, expect, vi, beforeEach } from "vitest";
import { TweenManager } from "../systems/TweenSystem.js";

let tween: TweenManager;
beforeEach(() => {
  tween = new TweenManager();
});

describe("TweenManager", () => {
  it("interpolates a property over time", () => {
    const obj: Record<string, number> = { x: 0 };
    tween.to(obj, { x: 100 }, { duration: 1.0 });
    tween.update(0.5);
    expect(obj["x"]).toBeCloseTo(50, 0);
    tween.update(0.5);
    expect(obj["x"]).toBeCloseTo(100, 0);
  });

  it("calls onComplete when tween finishes", () => {
    const obj: Record<string, number> = { y: 0 };
    const cb = vi.fn();
    tween.to(obj, { y: 1 }, { duration: 0.1, onComplete: cb });
    tween.update(0.2);
    expect(cb).toHaveBeenCalledOnce();
  });

  it("respects delay before starting", () => {
    const obj: Record<string, number> = { v: 0 };
    tween.to(obj, { v: 10 }, { duration: 0.5, delay: 0.5 });
    tween.update(0.4);
    expect(obj["v"]).toBe(0); // delay not elapsed
    tween.update(0.6);
    expect(obj["v"]).toBeGreaterThan(0);
  });

  it("destroy clears tweens and timers", () => {
    const obj: Record<string, number> = { x: 0 };
    tween.to(obj, { x: 100 }, { duration: 2.0 });
    tween.destroy();
    tween.update(1.0);
    expect(obj["x"]).toBe(0); // no tweens active after destroy
  });
});

describe("TweenManager timers", () => {
  it("fires after() once after delay", () => {
    const fn = vi.fn();
    tween.after(0.2, fn);
    tween.update(0.1);
    expect(fn).not.toHaveBeenCalled();
    tween.update(0.15);
    expect(fn).toHaveBeenCalledOnce();
    tween.update(1.0);
    expect(fn).toHaveBeenCalledOnce(); // not called again
  });

  it("fires every() repeatedly", () => {
    const fn = vi.fn();
    tween.every(0.1, fn);
    tween.update(0.35);
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

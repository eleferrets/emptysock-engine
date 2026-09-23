import { describe, it, expect, beforeEach } from "vitest";
import { SceneTransitionManager } from "../../ecs/systems/SceneTransition.js";
import type { TransitionEffectSink } from "../../ecs/systems/SceneTransition.js";

/**
 * RELEASE_PASS.md Track 6's port of `core/SceneManager.ts`'s scene-
 * transition timing logic, scenarios drawn from `__tests__/SceneManager.test.ts`
 * (this class deliberately doesn't own scene registration or a pause/resume
 * stack — see its own class doc comment for why).
 */

let manager: SceneTransitionManager;

beforeEach(() => {
  manager = new SceneTransitionManager();
});

describe("SceneTransitionManager", () => {
  it("calls load() once the transition's duration has elapsed", () => {
    let loaded = 0;
    manager.transition(
      () => {
        loaded++;
      },
      { duration: 0.1 },
    );

    expect(manager.isTransitioning).toBe(true);
    manager.update(0.05);
    expect(loaded).toBe(0);
    manager.update(0.1);
    expect(loaded).toBe(1);
    expect(manager.isTransitioning).toBe(false);
  });

  it("fires load() immediately with duration 0", () => {
    let loaded = false;
    manager.transition(
      () => {
        loaded = true;
      },
      { effect: "none", duration: 0 },
    );
    manager.update(0);
    expect(loaded).toBe(true);
  });

  it("a second transition() call replaces the pending load and resets elapsed time", () => {
    const calls: string[] = [];
    manager.transition(
      () => {
        calls.push("first");
      },
      { duration: 0.1 },
    );
    manager.update(0.08);
    manager.transition(
      () => {
        calls.push("second");
      },
      { duration: 0.1 },
    );
    manager.update(0.08); // 0.08 < 0.1 — would have fired "first" at 0.16 total if not reset
    expect(calls).toEqual([]);
    manager.update(0.02);
    expect(calls).toEqual(["second"]);
  });

  it("drives an attached TransitionEffectSink through begin/progress/end", () => {
    const calls: string[] = [];
    let progress = 0;
    const sink: TransitionEffectSink = {
      beginTransition: (effect) => calls.push(`begin:${effect}`),
      endTransition: () => calls.push("end"),
      get transitionProgress(): number {
        return progress;
      },
      set transitionProgress(v: number) {
        progress = v;
        calls.push(`progress:${v}`);
      },
    };
    manager.attachPostProcess(sink);

    manager.transition(
      () => {
        calls.push("loaded");
      },
      { duration: 0.2, effect: "fade" },
    );
    expect(calls[0]).toBe("begin:fade");

    manager.update(0.1);
    expect(progress).toBeCloseTo(0.5);

    manager.update(0.1);
    expect(calls).toContain("loaded");
    expect(calls[calls.length - 1]).toBe("end");
  });

  it("transitions safely with no attached sink — still times and calls load", () => {
    let loaded = false;
    manager.transition(
      () => {
        loaded = true;
      },
      { duration: 0.05 },
    );
    manager.update(0.05);
    expect(loaded).toBe(true);
  });

  it("update() is a no-op once no transition is pending", () => {
    expect(() => manager.update(1)).not.toThrow();
    expect(manager.isTransitioning).toBe(false);
  });
});

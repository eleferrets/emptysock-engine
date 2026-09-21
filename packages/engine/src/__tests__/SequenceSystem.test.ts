import { describe, it, expect } from "vitest";
import { TweenManager } from "../systems/TweenSystem.js";
import {
  SequenceSystem,
  evaluateTrackAt,
  type SequenceDefinition,
} from "../systems/SequenceSystem.js";

describe("SequenceSystem", () => {
  const track: SequenceDefinition["tracks"][number] = {
    property: "x",
    ease: "linear",
    keyframes: [
      { time: 0, value: 0 },
      { time: 1, value: 100 },
      { time: 2, value: 0 },
    ],
  };
  const def: SequenceDefinition = { duration: 2, tracks: [track] };

  it("evaluateTrackAt matches linear interpolation for a linear-eased track", () => {
    expect(evaluateTrackAt(track, 0)).toBe(0);
    expect(evaluateTrackAt(track, 0.5)).toBeCloseTo(50);
    expect(evaluateTrackAt(track, 1)).toBe(100);
    expect(evaluateTrackAt(track, 1.5)).toBeCloseTo(50);
    expect(evaluateTrackAt(track, 2)).toBe(0);
  });

  it("clamps before the first and after the last keyframe", () => {
    expect(evaluateTrackAt(track, -1)).toBe(0);
    expect(evaluateTrackAt(track, 5)).toBe(0);
  });

  it("play() drives a real TweenManager — target values match evaluateTrackAt as time advances", () => {
    const tweens = new TweenManager();
    const seq = new SequenceSystem();
    const target: Record<string, number> = { x: -999 };

    seq.play(tweens, target, def);

    // Advance in small steps, checking the tween-driven value tracks the
    // pure evaluation function (same easing math, same segments).
    const dt = 1 / 60;
    let t = 0;
    while (t < def.duration) {
      t += dt;
      tweens.update(dt);
      expect(target["x"]).toBeCloseTo(evaluateTrackAt(track, t), 0);
    }
  });

  it("stop() cancels all scheduled tweens", () => {
    const tweens = new TweenManager();
    const seq = new SequenceSystem();
    const target: Record<string, number> = { x: 0 };
    seq.play(tweens, target, def);
    seq.stop();
    tweens.update(2);
    // No further mutation once stopped, beyond the initial keyframe set.
    expect(target["x"]).toBe(0);
  });

  it("play() with startAt resumes mid-sequence without jumping", () => {
    const tweens = new TweenManager();
    const seq = new SequenceSystem();
    const target: Record<string, number> = { x: -999 };

    seq.play(tweens, target, def, 1.5);
    // At the resume point, target should already equal the pure evaluation.
    expect(target["x"]).toBeCloseTo(evaluateTrackAt(track, 1.5));

    let t = 1.5;
    const dt = 1 / 60;
    while (t < def.duration) {
      t += dt;
      tweens.update(dt);
      expect(target["x"]).toBeCloseTo(evaluateTrackAt(track, t), 0);
    }
  });

  it("a hand-written TweenManager chain produces the same result as play()", () => {
    // Reproduces the single-segment case by hand, as a developer would.
    const single: SequenceDefinition = {
      duration: 1,
      tracks: [
        {
          property: "y",
          ease: "quadOut",
          keyframes: [
            { time: 0, value: 0 },
            { time: 1, value: 50 },
          ],
        },
      ],
    };

    const tweensA = new TweenManager();
    const seq = new SequenceSystem();
    const targetA: Record<string, number> = { y: 0 };
    seq.play(tweensA, targetA, single);

    const tweensB = new TweenManager();
    const targetB: Record<string, number> = { y: 0 };
    tweensB.to(targetB, { y: 50 }, { duration: 1, ease: "quadOut" });

    for (let i = 0; i < 30; i++) {
      tweensA.update(1 / 30);
      tweensB.update(1 / 30);
      expect(targetA["y"]).toBeCloseTo(targetB["y"] ?? 0, 5);
    }
  });
});

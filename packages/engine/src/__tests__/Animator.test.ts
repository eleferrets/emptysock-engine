import { describe, it, expect } from "vitest";
import { Animator } from "../components/Animator.js";

describe("Animator", () => {
  it("starts idle", () => {
    const a = new Animator();
    expect(a.isPlaying).toBe(false);
    expect(a.currentClip).toBeNull();
  });

  it("addClip and play sets currentClip", () => {
    const a = new Animator();
    a.addClip({
      name: "run",
      frameStart: 0,
      frameEnd: 7,
      frameRate: 12,
      loop: true,
    });
    a.play("run");
    expect(a.isPlaying).toBe(true);
    expect(a.currentClip).toBe("run");
    expect(a.currentFrame).toBe(0);
  });

  it("play unknown clip stays idle", () => {
    const a = new Animator();
    a.play("nonexistent");
    expect(a.isPlaying).toBe(false);
  });

  it("stop pauses playback", () => {
    const a = new Animator();
    a.addClip({
      name: "idle",
      frameStart: 0,
      frameEnd: 3,
      frameRate: 8,
      loop: true,
    });
    a.play("idle");
    a.stop();
    expect(a.isPlaying).toBe(false);
  });

  it("update advances frame at correct rate", () => {
    const a = new Animator();
    a.addClip({
      name: "walk",
      frameStart: 0,
      frameEnd: 3,
      frameRate: 4,
      loop: true,
    });
    a.play("walk");
    a.update(0.25); // exactly one frame at 4fps
    expect(a.currentFrame).toBe(1);
  });

  it("non-looping clip stops at last frame", () => {
    const a = new Animator();
    a.addClip({
      name: "death",
      frameStart: 0,
      frameEnd: 1,
      frameRate: 10,
      loop: false,
    });
    a.play("death");
    a.update(1); // advance well past the end
    expect(a.isPlaying).toBe(false);
    expect(a.currentFrame).toBe(1);
  });

  it("serialize includes clips array", () => {
    const a = new Animator();
    a.addClip({
      name: "run",
      frameStart: 0,
      frameEnd: 5,
      frameRate: 12,
      loop: true,
    });
    const s = a.serialize();
    expect(Array.isArray(s["clips"])).toBe(true);
    expect((s["clips"] as unknown[]).length).toBe(1);
  });
});

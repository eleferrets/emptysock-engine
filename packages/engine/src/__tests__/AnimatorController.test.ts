import { describe, it, expect } from "vitest";
import { AnimatorController } from "../components/AnimatorController.js";
import type { AnimationClip } from "../components/Animator.js";

const idle: AnimationClip = {
  name: "idle",
  frameStart: 0,
  frameEnd: 3,
  frameRate: 4,
  loop: true,
};
const walk: AnimationClip = {
  name: "walk",
  frameStart: 0,
  frameEnd: 3,
  frameRate: 4,
  loop: true,
};
const attack: AnimationClip = {
  name: "attack",
  frameStart: 0,
  frameEnd: 1,
  frameRate: 10,
  loop: false,
};

describe("AnimatorController", () => {
  it("starts with no current state", () => {
    const c = new AnimatorController();
    expect(c.currentState).toBeNull();
    expect(c.getActiveClips()).toEqual([]);
  });

  it("play() sets the current state instantly", () => {
    const c = new AnimatorController();
    c.addState("idle", idle);
    c.play("idle");
    expect(c.currentState).toBe("idle");
    expect(c.getActiveClips()).toEqual([
      { state: "idle", clip: idle, frame: 0, weight: 1 },
    ]);
  });

  it("play() on unknown state warns and stays idle", () => {
    const c = new AnimatorController();
    c.play("nonexistent");
    expect(c.currentState).toBeNull();
  });

  it("advances frames like Animator when no transition fires", () => {
    const c = new AnimatorController();
    c.addState("walk", walk);
    c.play("walk");
    c.update(0.25); // one frame at 4fps
    expect(c.getActiveClips()[0]?.frame).toBe(1);
  });

  it("transitions instantly (duration 0) when condition becomes true", () => {
    const c = new AnimatorController();
    c.addState("idle", idle);
    c.addState("walk", walk);
    c.addTransition("idle", {
      to: "walk",
      condition: (ctx) => (ctx.getParam("speed") as number) > 0,
    });
    c.play("idle");

    c.setFloat("speed", 0);
    c.update(0.1);
    expect(c.currentState).toBe("idle");

    c.setFloat("speed", 5);
    c.update(0.1);
    expect(c.currentState).toBe("walk");
    expect(c.isBlending).toBe(false);
  });

  it("cross-fades over duration and reports both clips with interpolated weights", () => {
    const c = new AnimatorController();
    c.addState("idle", idle);
    c.addState("walk", walk);
    c.addTransition("idle", {
      to: "walk",
      condition: (ctx) => ctx.getParam("speed") === true,
      duration: 1, // seconds
    });
    c.play("idle");
    c.setBool("speed", true);

    c.update(0); // trigger transition, no time advance yet
    expect(c.isBlending).toBe(true);

    let clips = c.getActiveClips();
    expect(clips).toHaveLength(2);
    expect(clips[0]?.state).toBe("idle");
    expect(clips[0]?.weight).toBeCloseTo(1, 5);
    expect(clips[1]?.state).toBe("walk");
    expect(clips[1]?.weight).toBeCloseTo(0, 5);

    c.update(0.5); // halfway through the 1s blend
    clips = c.getActiveClips();
    expect(clips[0]?.weight).toBeCloseTo(0.5, 5);
    expect(clips[1]?.weight).toBeCloseTo(0.5, 5);
    expect(c.currentState).toBe("idle"); // not finalized yet

    c.update(0.5); // completes the blend
    expect(c.isBlending).toBe(false);
    expect(c.currentState).toBe("walk");
    expect(c.getActiveClips()).toHaveLength(1);
  });

  it("wildcard '*' transitions fire from any state", () => {
    const c = new AnimatorController();
    c.addState("idle", idle);
    c.addState("walk", walk);
    c.addState("attack", attack);
    c.addTransition("*", {
      to: "attack",
      condition: (ctx) => ctx.isTriggered("attack"),
    });
    c.play("walk");
    c.setTrigger("attack");
    c.update(0.01);
    expect(c.currentState).toBe("attack");
  });

  it("triggers auto-reset after being evaluated", () => {
    const c = new AnimatorController();
    c.addState("idle", idle);
    c.addState("attack", attack);
    c.addTransition("idle", {
      to: "attack",
      condition: (ctx) => ctx.isTriggered("go"),
    });
    c.addTransition("attack", {
      to: "idle",
      condition: (ctx) => ctx.isTriggered("go"),
    });
    c.play("idle");
    c.setTrigger("go");
    c.update(0.01);
    expect(c.currentState).toBe("attack");

    // trigger was consumed; without setting it again, no bounce back to idle
    c.update(0.01);
    expect(c.currentState).toBe("attack");
  });

  it("does not evaluate new transitions mid-blend", () => {
    const c = new AnimatorController();
    c.addState("idle", idle);
    c.addState("walk", walk);
    c.addState("attack", attack);
    c.addTransition("idle", { to: "walk", condition: () => true, duration: 1 });
    c.addTransition("walk", {
      to: "attack",
      condition: () => true,
      duration: 1,
    });
    c.play("idle");
    c.update(0.1); // starts idle->walk blend
    expect(c.isBlending).toBe(true);
    expect(c.currentState).toBe("idle");

    c.update(0.1); // still blending idle->walk; walk->attack condition is always true
    // but should not be considered until the current blend resolves
    expect(c.getActiveClips().map((a) => a.state)).toEqual(["idle", "walk"]);
  });

  it("serialize includes states array and currentState", () => {
    const c = new AnimatorController();
    c.addState("idle", idle);
    c.play("idle");
    const s = c.serialize();
    expect(Array.isArray(s["states"])).toBe(true);
    expect(s["currentState"]).toBe("idle");
  });
});

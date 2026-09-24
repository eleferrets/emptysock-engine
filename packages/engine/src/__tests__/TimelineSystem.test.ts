import { describe, it, expect, beforeEach } from "vitest";
import { Scene } from "../Scene.js";
import { TimelineSystem } from "../systems/TimelineSystem.js";
import {
  TimelineState,
  registerGmlTimeline,
  unregisterGmlTimeline,
} from "../components/GmlTimeline.js";
import type { GmlActionContext } from "../compat/gmlActions.js";

describe("TimelineSystem", () => {
  let scene: Scene;
  let system: TimelineSystem;
  let ctx: GmlActionContext;

  beforeEach(() => {
    scene = new Scene();
    system = new TimelineSystem();
    ctx = { scene };
  });

  it("does not advance or fire when not running", () => {
    const fired: number[] = [];
    registerGmlTimeline("t1", {
      moments: [{ step: 1, run: () => fired.push(1) }],
    });
    const entity = scene.spawn();
    entity.add(TimelineState, { timelineId: "t1", running: false });

    system.update(scene, ctx);

    expect(entity.get(TimelineState)?.["position"]).toBe(0);
    expect(fired).toEqual([]);
    unregisterGmlTimeline("t1");
  });

  it("advances by speed (default 1) each call and fires a moment when crossed", () => {
    const fired: number[] = [];
    registerGmlTimeline("t2", {
      moments: [
        { step: 0, run: () => fired.push(0) },
        { step: 2, run: () => fired.push(2) },
      ],
    });
    const entity = scene.spawn();
    entity.add(TimelineState, { timelineId: "t2", running: true });

    // First call: position starts at 0, moment at step 0 was already at the
    // start position, not "crossed" — fireCrossedMoments uses (from, to].
    system.update(scene, ctx);
    expect(entity.get(TimelineState)?.["position"]).toBe(1);
    expect(fired).toEqual([]);

    system.update(scene, ctx);
    expect(entity.get(TimelineState)?.["position"]).toBe(2);
    expect(fired).toEqual([2]);
    unregisterGmlTimeline("t2");
  });

  it("a speed > 1 can fire several moments in one step, in order", () => {
    const fired: number[] = [];
    registerGmlTimeline("t3", {
      moments: [
        { step: 1, run: () => fired.push(1) },
        { step: 2, run: () => fired.push(2) },
        { step: 3, run: () => fired.push(3) },
      ],
    });
    const entity = scene.spawn();
    entity.add(TimelineState, { timelineId: "t3", running: true, speed: 3 });

    system.update(scene, ctx);
    expect(fired).toEqual([1, 2, 3]);
    unregisterGmlTimeline("t3");
  });

  it("stops at the last moment when loop is false", () => {
    registerGmlTimeline("t4", {
      moments: [
        { step: 0, run: () => {} },
        { step: 1, run: () => {} },
      ],
    });
    const entity = scene.spawn();
    entity.add(TimelineState, {
      timelineId: "t4",
      running: true,
      loop: false,
      position: 1,
    });

    system.update(scene, ctx);
    expect(entity.get(TimelineState)?.["position"]).toBe(1);
    system.update(scene, ctx);
    expect(entity.get(TimelineState)?.["position"]).toBe(1);
    unregisterGmlTimeline("t4");
  });

  it("wraps back to 0 when loop is true", () => {
    const fired: number[] = [];
    registerGmlTimeline("t5", {
      moments: [
        { step: 0, run: () => fired.push(0) },
        { step: 1, run: () => fired.push(1) },
      ],
    });
    const entity = scene.spawn();
    entity.add(TimelineState, {
      timelineId: "t5",
      running: true,
      loop: true,
      position: 1,
    });

    system.update(scene, ctx);
    expect(entity.get(TimelineState)?.["position"]).toBe(0);
    unregisterGmlTimeline("t5");
  });
});

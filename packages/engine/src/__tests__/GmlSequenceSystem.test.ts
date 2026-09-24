import { describe, it, expect, beforeEach } from "vitest";
import { Scene } from "../Scene.js";
import { GmlSequenceSystem } from "../systems/GmlSequenceSystem.js";
import {
  GmlSequenceState,
  registerGmlSequence,
  unregisterGmlSequence,
} from "../components/GmlSequence.js";
import { Transform } from "../components/Transform.js";
import { Sprite } from "../components/Sprite.js";

describe("GmlSequenceSystem", () => {
  let scene: Scene;
  let system: GmlSequenceSystem;

  beforeEach(() => {
    scene = new Scene();
    system = new GmlSequenceSystem();
  });

  it("does nothing while not playing", () => {
    registerGmlSequence("s1", {
      length: 10,
      tracks: [
        {
          target: "transform.x",
          keyframes: [
            { time: 0, value: 0, interpolation: "linear" },
            { time: 10, value: 100, interpolation: "linear" },
          ],
        },
      ],
    });
    const entity = scene.spawn();
    entity.add(Transform, { x: 5 });
    entity.add(GmlSequenceState, { sequenceId: "s1", playing: false });

    system.update(scene, 1);
    expect(entity.get(Transform)?.x).toBe(5);
    unregisterGmlSequence("s1");
  });

  it("linearly interpolates a Transform field over the playhead", () => {
    registerGmlSequence("s2", {
      length: 10,
      tracks: [
        {
          target: "transform.x",
          keyframes: [
            { time: 0, value: 0, interpolation: "linear" },
            { time: 10, value: 100, interpolation: "linear" },
          ],
        },
      ],
    });
    const entity = scene.spawn();
    entity.add(Transform);
    // speed is in frames/sec; use 10 fps so 0.5s == 5 frames == halfway.
    entity.add(GmlSequenceState, {
      sequenceId: "s2",
      playing: true,
      speed: 10,
    });

    system.update(scene, 0.5);
    expect(entity.get(Transform)?.x).toBeCloseTo(50, 0);
    unregisterGmlSequence("s2");
  });

  it("step interpolation holds the value until the next keyframe", () => {
    registerGmlSequence("s3", {
      length: 10,
      tracks: [
        {
          target: "sprite.alpha",
          keyframes: [
            { time: 0, value: 1, interpolation: "step" },
            { time: 5, value: 0, interpolation: "linear" },
          ],
        },
      ],
    });
    const entity = scene.spawn();
    entity.add(Sprite);
    entity.add(GmlSequenceState, {
      sequenceId: "s3",
      playing: true,
      speed: 10,
    });

    system.update(scene, 0.2); // position = 2, still before the step's next keyframe
    expect(entity.get(Sprite)?.alpha).toBe(1);
    unregisterGmlSequence("s3");
  });

  it("stops at the end when not looping, wraps when looping", () => {
    registerGmlSequence("s4", {
      length: 4,
      tracks: [
        {
          target: "transform.x",
          keyframes: [
            { time: 0, value: 0, interpolation: "linear" },
            { time: 4, value: 40, interpolation: "linear" },
          ],
        },
      ],
    });
    const stopEntity = scene.spawn();
    stopEntity.add(Transform);
    stopEntity.add(GmlSequenceState, {
      sequenceId: "s4",
      playing: true,
      speed: 10,
      loop: false,
    });
    system.update(scene, 1); // 10 frames advanced, length is 4 -> clamps to 4
    expect(stopEntity.get(GmlSequenceState)?.["position"]).toBe(4);
    expect(stopEntity.get(GmlSequenceState)?.["playing"]).toBe(false);

    const loopEntity = scene.spawn();
    loopEntity.add(Transform);
    loopEntity.add(GmlSequenceState, {
      sequenceId: "s4",
      playing: true,
      speed: 10,
      loop: true,
    });
    system.update(scene, 1); // 10 frames, length 4 -> wraps via modulo
    expect(loopEntity.get(GmlSequenceState)?.["playing"]).toBe(true);
    expect(loopEntity.get(GmlSequenceState)?.["position"]).toBeLessThanOrEqual(
      4,
    );
    unregisterGmlSequence("s4");
  });
});

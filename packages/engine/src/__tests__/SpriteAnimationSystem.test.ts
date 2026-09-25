import { describe, it, expect } from "vitest";
import { Scene } from "../Scene.js";
import { Sprite, resolveSpriteFramePath } from "../components/Sprite.js";
import { SpriteAnimationSystem } from "../systems/SpriteAnimationSystem.js";

describe("SpriteAnimationSystem", () => {
  it("does not advance a static (frameCount <= 1) sprite", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    entity.add(Sprite, { frameCount: 1, frameSpeed: 1 });
    const sys = new SpriteAnimationSystem();
    sys.update(scene);
    expect(entity.get(Sprite)?.currentFrame).toBe(0);
  });

  it("does not advance when frameSpeed is 0, even with multiple frames", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    entity.add(Sprite, { frameCount: 4, frameSpeed: 0 });
    const sys = new SpriteAnimationSystem();
    sys.update(scene);
    sys.update(scene);
    expect(entity.get(Sprite)?.currentFrame).toBe(0);
  });

  it("advances currentFrame by frameSpeed each tick", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    entity.add(Sprite, { frameCount: 4, frameSpeed: 1 });
    const sys = new SpriteAnimationSystem();
    sys.update(scene);
    expect(entity.get(Sprite)?.currentFrame).toBe(1);
    sys.update(scene);
    expect(entity.get(Sprite)?.currentFrame).toBe(2);
  });

  it("wraps via modulo against frameCount when looping", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    entity.add(Sprite, {
      frameCount: 3,
      frameSpeed: 1,
      currentFrame: 2,
      loop: true,
    });
    const sys = new SpriteAnimationSystem();
    sys.update(scene);
    expect(entity.get(Sprite)?.currentFrame).toBe(0);
  });

  it("clamps at the last frame when not looping", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    entity.add(Sprite, {
      frameCount: 3,
      frameSpeed: 1,
      currentFrame: 2,
      loop: false,
    });
    const sys = new SpriteAnimationSystem();
    sys.update(scene);
    expect(entity.get(Sprite)?.currentFrame).toBe(2);
    sys.update(scene);
    expect(entity.get(Sprite)?.currentFrame).toBe(2);
  });

  it("accumulates a fractional frameSpeed correctly across ticks", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    entity.add(Sprite, { frameCount: 4, frameSpeed: 0.5 });
    const sys = new SpriteAnimationSystem();
    sys.update(scene);
    expect(entity.get(Sprite)?.currentFrame).toBeCloseTo(0.5);
    sys.update(scene);
    expect(entity.get(Sprite)?.currentFrame).toBeCloseTo(1);
  });

  it("wraps a negative frameSpeed (backwards playback) correctly", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    entity.add(Sprite, {
      frameCount: 3,
      frameSpeed: -1,
      currentFrame: 0,
      loop: true,
    });
    const sys = new SpriteAnimationSystem();
    sys.update(scene);
    expect(entity.get(Sprite)?.currentFrame).toBe(2);
  });
});

describe("resolveSpriteFramePath", () => {
  it("returns texturePath unchanged for a static (frameCount <= 1) sprite", () => {
    expect(
      resolveSpriteFramePath({
        texturePath: "./assets/sprites/foo/frame_0.png",
        frameCount: 1,
        currentFrame: 0,
      }),
    ).toBe("./assets/sprites/foo/frame_0.png");
  });

  it("replaces {n} with the floored, wrapped frame index", () => {
    expect(
      resolveSpriteFramePath({
        texturePath: "./assets/sprites/foo/frame_{n}.png",
        frameCount: 4,
        currentFrame: 2.9,
      }),
    ).toBe("./assets/sprites/foo/frame_2.png");
  });

  it("wraps an out-of-range currentFrame via modulo", () => {
    expect(
      resolveSpriteFramePath({
        texturePath: "./assets/sprites/foo/frame_{n}.png",
        frameCount: 3,
        currentFrame: 5,
      }),
    ).toBe("./assets/sprites/foo/frame_2.png");
  });
});

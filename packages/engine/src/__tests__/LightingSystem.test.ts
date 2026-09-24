import { describe, expect, it } from "vitest";
import { Scene } from "../Scene.js";
import { Transform } from "../components/Transform.js";
import { LightSource } from "../components/LightSource.js";
import { LightingSystem } from "../systems/LightingSystem.js";

function spawnLight(
  scene: Scene,
  x: number,
  y: number,
  overrides: Partial<ReturnType<typeof LightSource.createDefaults>> = {},
): void {
  const entity = scene.spawn();
  entity.add(Transform, { x, y });
  entity.add(LightSource, overrides);
}

describe("LightingSystem.collectLights", () => {
  it("returns a light at its Transform position plus offset", () => {
    const scene = new Scene();
    spawnLight(scene, 100, 200, {
      radius: 64,
      colour: 0xff8800,
      intensity: 1.5,
      offsetX: 10,
      offsetY: -5,
    });

    const lighting = new LightingSystem();
    const lights = lighting.collectLights(scene);

    expect(lights).toHaveLength(1);
    expect(lights[0]).toMatchObject({
      x: 110,
      y: 195,
      radius: 64,
      colour: 0xff8800,
      intensity: 1.5,
    });
  });

  it("skips a disabled light entirely", () => {
    const scene = new Scene();
    spawnLight(scene, 0, 0, { enabled: false });

    const lighting = new LightingSystem();
    expect(lighting.collectLights(scene)).toHaveLength(0);
  });

  it("skips a light with a non-positive radius", () => {
    const scene = new Scene();
    spawnLight(scene, 0, 0, { radius: 0 });
    spawnLight(scene, 0, 0, { radius: -10 });

    const lighting = new LightingSystem();
    expect(lighting.collectLights(scene)).toHaveLength(0);
  });

  it("an entity with LightSource but no Transform is not queried (Scene.each requires both)", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    entity.add(LightSource);

    const lighting = new LightingSystem();
    expect(lighting.collectLights(scene)).toHaveLength(0);
  });

  it("combines multiple lights without one darkening another (each is a separate sample, not merged)", () => {
    const scene = new Scene();
    spawnLight(scene, 0, 0, { colour: 0xff0000 });
    spawnLight(scene, 500, 500, { colour: 0x00ff00 });

    const lighting = new LightingSystem();
    const lights = lighting.collectLights(scene);

    expect(lights).toHaveLength(2);
    expect(lights.map((l) => l.colour).sort()).toEqual(
      [0xff0000, 0x00ff00].sort(),
    );
  });

  it("degrades gracefully past maxLights: keeps the N nearest the reference point, not an arbitrary subset", () => {
    const scene = new Scene();
    // Five lights at x = 0, 100, 200, 300, 400. Reference at x = 0: nearest
    // three are 0, 100, 200.
    spawnLight(scene, 0, 0);
    spawnLight(scene, 100, 0);
    spawnLight(scene, 200, 0);
    spawnLight(scene, 300, 0);
    spawnLight(scene, 400, 0);

    const lighting = new LightingSystem({ maxLights: 3 });
    const lights = lighting.collectLights(scene, { x: 0, y: 0 });

    expect(lights).toHaveLength(3);
    expect(lights.map((l) => l.x).sort((a, b) => a - b)).toEqual([0, 100, 200]);
  });

  it("does not crash and returns exactly maxLights when far more lights are live", () => {
    const scene = new Scene();
    for (let i = 0; i < 100; i++) {
      spawnLight(scene, i * 10, 0);
    }

    const lighting = new LightingSystem({ maxLights: 16 });
    expect(lighting.collectLights(scene)).toHaveLength(16);
  });

  it("defaults maxLights to 32", () => {
    const lighting = new LightingSystem();
    expect(lighting.maxLights).toBe(32);
  });

  it("ambient defaults to pitch black (level 0) with a white/neutral tint", () => {
    const lighting = new LightingSystem();
    expect(lighting.ambient).toEqual({ colour: 0xffffff, level: 0 });
  });
});

import { describe, expect, it } from "vitest";
import { Scene } from "../Scene.js";
import { Transform } from "../components/Transform.js";
import { LightSource } from "../components/LightSource.js";
import { LightOccluder } from "../components/LightOccluder.js";
import { LightingSystem, type LightSample } from "../systems/LightingSystem.js";
import { pointInPolygon } from "../systems/LightOcclusion.js";

/** `noUncheckedIndexedAccess`-safe "the one light this test expects" accessor. */
function firstLight(lights: LightSample[]): LightSample {
  const light = lights[0];
  if (light === undefined) throw new Error("expected at least one light");
  return light;
}

function spawnOccluder(
  scene: Scene,
  x: number,
  y: number,
  overrides: Partial<ReturnType<typeof LightOccluder.createDefaults>> = {},
): void {
  const entity = scene.spawn();
  entity.add(Transform, { x, y });
  entity.add(LightOccluder, overrides);
}

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

  it("a light with no LightOccluder nearby has visibility: null (backward-compatible fast path)", () => {
    const scene = new Scene();
    spawnLight(scene, 0, 0, { radius: 200 });

    const lighting = new LightingSystem();
    const lights = lighting.collectLights(scene);

    expect(firstLight(lights).visibility).toBeNull();
  });

  it("a torch on one side of a wall does not illuminate a point directly behind it", () => {
    const scene = new Scene();
    spawnLight(scene, 0, 0, { radius: 200 });
    // A wall segment 50px to the right of the light, spanning y in [-100, 100].
    spawnOccluder(scene, 50, 0, { width: 10, height: 200 });

    const lighting = new LightingSystem();
    const light = firstLight(lighting.collectLights(scene));

    expect(light.visibility).not.toBeNull();
    const visibility = light.visibility;
    if (visibility === null) throw new Error("expected a visibility polygon");
    // Directly behind the wall from the light's perspective.
    expect(pointInPolygon({ x: 150, y: 0 }, visibility)).toBe(false);
    // Beside the wall — outside its shadow, inside the light's radius.
    expect(pointInPolygon({ x: 50, y: 150 }, visibility)).toBe(true);
  });

  it("an occluder outside the light's radius does not affect it (spatial culling)", () => {
    const scene = new Scene();
    spawnLight(scene, 0, 0, { radius: 50 });
    spawnOccluder(scene, 500, 0, { width: 10, height: 200 });

    const lighting = new LightingSystem();
    const light = firstLight(lighting.collectLights(scene));

    expect(light.visibility).toBeNull();
  });

  it("a disabled occluder is skipped entirely", () => {
    const scene = new Scene();
    spawnLight(scene, 0, 0, { radius: 200 });
    spawnOccluder(scene, 50, 0, { width: 10, height: 200, enabled: false });

    const lighting = new LightingSystem();
    const light = firstLight(lighting.collectLights(scene));

    expect(light.visibility).toBeNull();
  });

  it("a light close enough to a short occluder still illuminates the area beyond its ends", () => {
    const scene = new Scene();
    spawnLight(scene, 0, 0, { radius: 150 });
    // A short wall — only 20 units tall — 30 units away.
    spawnOccluder(scene, 30, 0, { width: 10, height: 20 });

    const lighting = new LightingSystem();
    const light = firstLight(lighting.collectLights(scene));

    expect(light.visibility).not.toBeNull();
    const visibility = light.visibility;
    if (visibility === null) throw new Error("expected a visibility polygon");
    // Directly behind the short wall: shadowed.
    expect(pointInPolygon({ x: 100, y: 0 }, visibility)).toBe(false);
    // Past the wall's ends: lit again (wrap-around).
    expect(pointInPolygon({ x: 100, y: 80 }, visibility)).toBe(true);
    expect(pointInPolygon({ x: 100, y: -80 }, visibility)).toBe(true);
  });
});

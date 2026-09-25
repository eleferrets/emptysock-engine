import { describe, expect, it } from "vitest";
import { Scene } from "../Scene.js";
import { Transform } from "../components/Transform.js";
import { LightSource } from "../components/LightSource.js";
import { LightOccluder } from "../components/LightOccluder.js";
import { LightingSystem } from "../systems/LightingSystem.js";
import {
  light_attach,
  light_set_enabled,
  light_set_colour,
  light_set_radius,
  light_set_intensity,
  light_remove,
  light_occluder_attach,
  light_occluder_set_enabled,
  light_occluder_remove,
  lighting_set_ambient,
  lighting_get_ambient,
  type GmlLightingContext,
} from "../compat/gmlLighting.js";

function defined<T>(value: T | undefined | null): T {
  if (value === undefined || value === null) {
    throw new Error("expected a defined value");
  }
  return value;
}

describe("gmlLighting compat — light_attach / setters / remove", () => {
  it("attaches a real, live LightSource with the given radius/colour and sane defaults", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    const ctx: GmlLightingContext = { scene };

    light_attach(entity, ctx, 150, 0xff8800);

    const light = defined(entity.get(LightSource));
    expect(light.radius).toBe(150);
    expect(light.colour).toBe(0xff8800);
    expect(light.intensity).toBe(1);
    expect(light.falloff).toBe(1);
    expect(light.enabled).toBe(true);
    expect(light.coneAngle).toBe(360);
  });

  it("accepts cone options for a spot/flashlight-style light", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    const ctx: GmlLightingContext = { scene };

    light_attach(entity, ctx, 200, 0xffffff, {
      coneAngle: 60,
      coneDirection: 90,
      intensity: 0.8,
    });

    const light = defined(entity.get(LightSource));
    expect(light.coneAngle).toBe(60);
    expect(light.coneDirection).toBe(90);
    expect(light.intensity).toBe(0.8);
  });

  it("re-attaching reconfigures the existing LightSource in place rather than throwing", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    const ctx: GmlLightingContext = { scene };

    light_attach(entity, ctx, 100, 0xffffff);
    expect(() => light_attach(entity, ctx, 250, 0x00ff00)).not.toThrow();

    const light = defined(entity.get(LightSource));
    expect(light.radius).toBe(250);
    expect(light.colour).toBe(0x00ff00);
  });

  it("light_set_enabled/colour/radius/intensity mutate an existing light and no-op without one", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    const ctx: GmlLightingContext = { scene };

    // No LightSource yet — every setter must be a safe no-op.
    expect(() => light_set_enabled(entity, ctx, false)).not.toThrow();
    expect(() => light_set_colour(entity, ctx, 0xff0000)).not.toThrow();
    expect(() => light_set_radius(entity, ctx, 42)).not.toThrow();
    expect(() => light_set_intensity(entity, ctx, 0.5)).not.toThrow();
    expect(entity.has(LightSource)).toBe(false);

    light_attach(entity, ctx, 100, 0xffffff);
    light_set_enabled(entity, ctx, false);
    light_set_colour(entity, ctx, 0x112233);
    light_set_radius(entity, ctx, 77);
    light_set_intensity(entity, ctx, 0.3);

    const light = defined(entity.get(LightSource));
    expect(light.enabled).toBe(false);
    expect(light.colour).toBe(0x112233);
    expect(light.radius).toBe(77);
    expect(light.intensity).toBe(0.3);
  });

  it("light_remove strips the component entirely; a second call is a safe no-op", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    const ctx: GmlLightingContext = { scene };

    light_attach(entity, ctx, 100, 0xffffff);
    expect(entity.has(LightSource)).toBe(true);
    light_remove(entity, ctx);
    expect(entity.has(LightSource)).toBe(false);
    expect(() => light_remove(entity, ctx)).not.toThrow();
  });

  it("an attached light is real, live data LightingSystem.collectLights() actually sees", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    entity.add(Transform);
    const ctx: GmlLightingContext = { scene };
    light_attach(entity, ctx, 120, 0x00ffff);

    const lighting = new LightingSystem();
    const lights = lighting.collectLights(scene);
    expect(lights).toHaveLength(1);
    expect(lights[0]?.radius).toBe(120);
    expect(lights[0]?.colour).toBe(0x00ffff);
  });
});

describe("gmlLighting compat — light_occluder_attach / setters / remove", () => {
  it("attaches a real LightOccluder box with explicit size", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    const ctx: GmlLightingContext = { scene };

    light_occluder_attach(entity, ctx, 64, 96);

    const occluder = defined(entity.get(LightOccluder));
    expect(occluder.width).toBe(64);
    expect(occluder.height).toBe(96);
    expect(occluder.enabled).toBe(true);
  });

  it("falls back to a real default size when no width/height is given", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    const ctx: GmlLightingContext = { scene };

    light_occluder_attach(entity, ctx);

    const occluder = defined(entity.get(LightOccluder));
    expect(occluder.width).toBeGreaterThan(0);
    expect(occluder.height).toBeGreaterThan(0);
  });

  it("light_occluder_set_enabled toggles without removing the component", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    const ctx: GmlLightingContext = { scene };

    light_occluder_attach(entity, ctx, 32, 32);
    light_occluder_set_enabled(entity, ctx, false);
    expect(defined(entity.get(LightOccluder)).enabled).toBe(false);
    expect(entity.has(LightOccluder)).toBe(true);
  });

  it("light_occluder_remove strips the component; a second call is a safe no-op", () => {
    const scene = new Scene();
    const entity = scene.spawn();
    const ctx: GmlLightingContext = { scene };

    light_occluder_attach(entity, ctx, 32, 32);
    light_occluder_remove(entity, ctx);
    expect(entity.has(LightOccluder)).toBe(false);
    expect(() => light_occluder_remove(entity, ctx)).not.toThrow();
  });
});

describe("gmlLighting compat — lighting_set_ambient / lighting_get_ambient", () => {
  it("sets and reads back the ambient darkness on a real, wired LightingSystem", () => {
    const scene = new Scene();
    const lighting = new LightingSystem();
    const ctx: GmlLightingContext = { scene, lighting };

    lighting_set_ambient(ctx, 0x223344, 0.25);

    expect(lighting.ambient).toEqual({ colour: 0x223344, level: 0.25 });
    expect(lighting_get_ambient(ctx)).toEqual({
      colour: 0x223344,
      level: 0.25,
    });
  });

  it("is a safe no-op with no LightingSystem wired, and read returns the honest default", () => {
    const scene = new Scene();
    const ctx: GmlLightingContext = { scene };

    expect(() => lighting_set_ambient(ctx, 0x000000, 0)).not.toThrow();
    expect(lighting_get_ambient(ctx)).toEqual({ colour: 0xffffff, level: 0 });
  });
});

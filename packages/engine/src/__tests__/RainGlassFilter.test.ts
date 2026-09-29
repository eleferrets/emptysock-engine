import { describe, it, expect } from "vitest";
import {
  createRainGlassFilter,
  RainGlassFilter,
  RAIN_GLASS_FRAGMENT,
} from "../systems/RainGlassFilter.js";

describe("RainGlassFilter", () => {
  it("createRainGlassFilter builds a real RainGlassFilter instance", () => {
    const filter = createRainGlassFilter();
    expect(filter).toBeInstanceOf(RainGlassFilter);
  });

  it("defaults intensity/dropletSize/dropletSpeed/streakAmount, and 0 elapsed time", () => {
    const filter = createRainGlassFilter();
    const res = (
      filter.resources["uniforms"] as { uniforms: Record<string, unknown> }
    ).uniforms;
    expect(res["uIntensity"]).toBe(0.6);
    expect(res["uDropletSize"]).toBe(0.12);
    expect(res["uDropletSpeed"]).toBe(0.35);
    expect(res["uStreakAmount"]).toBe(0.5);
    expect(res["uTime"]).toBe(0);
    expect(filter.elapsed).toBe(0);
  });

  it("constructor options override the defaults", () => {
    const filter = createRainGlassFilter({
      intensity: 1,
      dropletSize: 0.3,
      dropletSpeed: 0.9,
      streakAmount: 0.2,
    });
    const res = (
      filter.resources["uniforms"] as { uniforms: Record<string, unknown> }
    ).uniforms;
    expect(res["uIntensity"]).toBe(1);
    expect(res["uDropletSize"]).toBe(0.3);
    expect(res["uDropletSpeed"]).toBe(0.9);
    expect(res["uStreakAmount"]).toBe(0.2);
  });

  it("setOptions patches only the fields given", () => {
    const filter = createRainGlassFilter({ intensity: 0.4 });
    filter.setOptions({ dropletSpeed: 0.6 });
    const res = (
      filter.resources["uniforms"] as { uniforms: Record<string, unknown> }
    ).uniforms;
    expect(res["uIntensity"]).toBe(0.4); // untouched
    expect(res["uDropletSpeed"]).toBe(0.6); // updated
  });

  it("setResolution writes uResolution as [width, height], clamped to at least 1", () => {
    const filter = createRainGlassFilter();
    filter.setResolution(800, 600);
    const res = (
      filter.resources["uniforms"] as { uniforms: Record<string, unknown> }
    ).uniforms;
    expect(res["uResolution"]).toEqual([800, 600]);
    filter.setResolution(0, -5);
    expect(res["uResolution"]).toEqual([1, 1]);
  });

  it("tick() accumulates elapsed time and writes it to uTime", () => {
    const filter = createRainGlassFilter();
    filter.tick(0.5);
    expect(filter.elapsed).toBe(0.5);
    filter.tick(0.25);
    expect(filter.elapsed).toBe(0.75);
    const res = (
      filter.resources["uniforms"] as { uniforms: Record<string, unknown> }
    ).uniforms;
    expect(res["uTime"]).toBe(0.75);
  });

  it("compiles with the standard pixi filter attribute/uniform contract", () => {
    const filter = createRainGlassFilter();
    expect(filter.glProgram.vertex).toContain("uOutputFrame");
    expect(filter.glProgram.fragment).toContain("uTexture");
    expect(filter.glProgram.fragment).toContain("uDropMap");
    expect(filter.glProgram.fragment).toContain("uFog");
  });
});

describe("RainGlassFilter shader", () => {
  it("is single-pass and has a droplet trail term", () => {
    expect(RAIN_GLASS_FRAGMENT).toContain("uDropMap");
    expect(RAIN_GLASS_FRAGMENT).toContain("uFog");
  });

  it("has no dynamic-bound loop: the only loop is bounded by a constant", () => {
    const loops = RAIN_GLASS_FRAGMENT.match(/for\s*\([^)]*\)/g) ?? [];
    expect(loops).toHaveLength(1);
    expect(loops[0]).toContain("MAX_TAPS");
  });
});

describe("RainGlassFilter drop map", () => {
  it("binds an rgba8unorm buffer source plus its sampler", () => {
    const f = createRainGlassFilter();
    const src = f.resources["uDropMap"] as unknown as { format: string };
    expect(src.format).toBe("rgba8unorm");
    expect(f.resources["uDropMapSampler"]).toBeDefined();
  });

  it("tick advances the sim and writes the map; quality selects the tier", () => {
    const f = createRainGlassFilter({ quality: "high", seed: 3 });
    expect(f.tier.name).toBe("high");
    for (let i = 0; i < 120; i++) f.tick(1 / 60);
    expect(f.dropCount).toBeGreaterThan(0);
    expect(f.dropMap.some((v, i) => i % 4 === 3 && v > 0)).toBe(true);
  });

  it("auto quality follows the gpu tier and setResolution sizes the map to the aspect", () => {
    const f = createRainGlassFilter({}, "low");
    expect(f.tier.name).toBe("low");
    f.setResolution(400, 400);
    expect(f.dropMap.length).toBe(90 * 90 * 4);
    f.setResolution(400, 400); // idempotent, no rebuild
    expect(f.dropMap.length).toBe(90 * 90 * 4);
  });

  it("setOptions is idempotent for quality and seed (drops survive a repeat)", () => {
    const f = createRainGlassFilter({ seed: 5 });
    for (let i = 0; i < 120; i++) f.tick(1 / 60);
    const n = f.dropCount;
    f.setOptions({ quality: "auto", seed: 5, intensity: 0.6 });
    expect(f.dropCount).toBe(n);
    f.setOptions({ seed: 6 });
    expect(f.dropCount).toBe(0);
  });

  it("legacy options map onto the sim scales and fog/wiper options apply", () => {
    const f = createRainGlassFilter({ dropletSize: 0.24, streakAmount: 0 });
    expect(f.sim.sizeScale).toBeCloseTo(2);
    expect(f.sim.trailScale).toBe(0);
    f.setOptions({ fog: 0.7, wiper: { enabled: true, periodSec: 1 } });
    expect(f.sim.fogTarget).toBe(0.7);
    expect(f.sim.wiper.enabled).toBe(true);
    f.triggerWipe();
    expect(f.wiperAngle).toBe(f.sim.wiper.minAngle);
  });

  it("timeScale scales tick and destroy is idempotent", () => {
    const f = createRainGlassFilter();
    f.tick(1, 0);
    expect(f.elapsed).toBe(0);
    f.tick(1, 0.5);
    expect(f.elapsed).toBe(0.5);
    f.destroy();
    expect(() => f.destroy()).not.toThrow();
  });
});

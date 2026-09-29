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
    expect(filter.glProgram.fragment).toContain("uDropletSize");
    expect(filter.glProgram.fragment).toContain("uStreakAmount");
  });
});

describe("RainGlassFilter shader", () => {
  it("is single-pass and has a droplet trail term", () => {
    expect(RAIN_GLASS_FRAGMENT).toContain("float trail");
    expect(RAIN_GLASS_FRAGMENT).not.toMatch(/for\s*\(/);
  });
});

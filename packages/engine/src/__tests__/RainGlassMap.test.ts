import { describe, it, expect } from "vitest";
import { RainGlassSim } from "../systems/RainGlassSim.js";
import { rasterizeRainDropMap } from "../systems/RainGlassMap.js";
import {
  RAIN_TIERS,
  RAIN_TIER_ORDER,
  rainMapSize,
  resolveRainQuality,
  resolveRainTier,
} from "../systems/RainGlassTiers.js";

function sim() {
  return new RainGlassSim({
    width: 41,
    height: 41,
    maxDrops: 4,
    spawnPerSec: 0,
  });
}
const px = (b: Uint8Array, w: number, x: number, y: number) => {
  const o = (y * w + x) * 4;
  return [b[o]!, b[o + 1]!, b[o + 2]!, b[o + 3]!];
};

describe("rasterizeRainDropMap", () => {
  it("empty sim gives a flat, clear map", () => {
    const s = sim();
    const out = new Uint8Array(41 * 41 * 4).fill(9);
    rasterizeRainDropMap(s, out);
    expect(px(out, 41, 5, 5)).toEqual([128, 128, 0, 0]);
  });

  it("a single drop: max thickness at centre, flat outside, mask set, mirror symmetric", () => {
    const s = sim();
    s.addDrop(20.5, 20.5, 8);
    const out = new Uint8Array(41 * 41 * 4);
    rasterizeRainDropMap(s, out);
    const c = px(out, 41, 20, 20);
    expect(c[2]).toBe(255);
    expect(c[3]).toBe(255);
    expect(c[0]).toBe(128);
    expect(px(out, 41, 20, 5)).toEqual([128, 128, 0, 0]);
    for (let d = 1; d < 8; d++) {
      const l = px(out, 41, 20 - d, 20);
      const r = px(out, 41, 20 + d, 20);
      const u = px(out, 41, 20, 20 - d);
      const dn = px(out, 41, 20, 20 + d);
      expect(l[0]! - 128).toBe(128 - r[0]!);
      expect(l[2]).toBe(r[2]);
      expect(u[1]! - 128).toBe(128 - dn[1]!);
      expect(u[2]).toBe(dn[2]);
    }
  });

  it("wet trail film shows in B and A below drop values", () => {
    const s = sim();
    s.wet[5 * 41 + 5] = 200;
    const out = new Uint8Array(41 * 41 * 4);
    rasterizeRainDropMap(s, out);
    const t = px(out, 41, 5, 5);
    expect(t[2]).toBeLessThan(64);
    expect(t[3]).toBe(255);
  });
});

describe("rain tiers", () => {
  it("capacity, map size and spawn rate are monotonic potato to high", () => {
    for (let i = 1; i < RAIN_TIER_ORDER.length; i++) {
      const a = RAIN_TIERS[RAIN_TIER_ORDER[i - 1]!];
      const b = RAIN_TIERS[RAIN_TIER_ORDER[i]!];
      expect(b.maxDrops).toBeGreaterThan(a.maxDrops);
      expect(b.mapW).toBeGreaterThan(a.mapW);
      expect(b.spawnPerSec).toBeGreaterThan(a.spawnPerSec);
    }
    expect(RAIN_TIERS.potato.trails).toBe(false);
  });

  it("resolveRainTier maps host tiers and falls back to medium", () => {
    expect(resolveRainTier("potato")).toBe("potato");
    expect(resolveRainTier("low")).toBe("low");
    expect(resolveRainTier("mid")).toBe("medium");
    expect(resolveRainTier("high")).toBe("high");
    expect(resolveRainTier("nope")).toBe("medium");
    expect(resolveRainTier(undefined)).toBe("medium");
  });

  it("resolveRainQuality honours explicit quality over auto", () => {
    expect(resolveRainQuality("auto", "high").name).toBe("high");
    expect(resolveRainQuality("low", "high").name).toBe("low");
    expect(resolveRainQuality(undefined, undefined).name).toBe("medium");
  });

  it("rainMapSize follows aspect and guards bad input", () => {
    expect(rainMapSize(RAIN_TIERS.medium, 16 / 9)).toEqual({
      width: 256,
      height: 144,
    });
    expect(rainMapSize(RAIN_TIERS.medium, NaN).width).toBe(256);
  });
});

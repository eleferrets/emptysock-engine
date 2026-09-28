import { describe, it, expect } from "vitest";
import { ParticleEmitter, rainParticlePreset } from "../index.js";

describe("rainParticlePreset", () => {
  it("emits downward-moving drops along a line", () => {
    const e = new ParticleEmitter(rainParticlePreset({ width: 400 }));
    e.x = 200;
    e.y = -10;
    for (let i = 0; i < 30; i++) e.update(1 / 60);
    const ps = e.getParticles();
    expect(ps.length).toBeGreaterThan(0);
    expect(ps.every((p) => p.y > -10)).toBe(true);
  });
  it("wind shifts acceleration", () => {
    expect(rainParticlePreset({ wind: 50 }).acceleration?.x).toBe(50);
  });
});

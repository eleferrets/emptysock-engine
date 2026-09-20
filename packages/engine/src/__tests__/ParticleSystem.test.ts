import { describe, it, expect, beforeEach } from "vitest";
import {
  ParticleSystem,
  ParticleEmitter,
  type ParticleEmitterOptions,
} from "../systems/ParticleSystem.js";

let ps: ParticleSystem;
beforeEach(() => {
  ps = new ParticleSystem();
});

describe("ParticleSystem", () => {
  it("creates an emitter and tracks it", () => {
    const e = ps.create({ emissionRate: 10, lifetime: { min: 1, max: 1 } });
    expect(ps.emitters).toContain(e);
  });

  it("burst emit spawns correct count", () => {
    const e = ps.create({ emissionRate: 0 });
    e.active = false;
    e.emit(5);
    expect(e.activeCount).toBe(5);
  });

  it("particles die after their lifetime", () => {
    const e = ps.create({ emissionRate: 0, lifetime: { min: 0.1, max: 0.1 } });
    e.emit(3);
    ps.update(0.05);
    expect(e.activeCount).toBe(3);
    ps.update(0.1);
    expect(e.activeCount).toBe(0);
  });

  it("continuous emission accumulates particles over time", () => {
    const e = ps.create({
      emissionRate: 10,
      lifetime: { min: 5, max: 5 },
      maxParticles: 100,
    });
    ps.update(0.5); // should emit ~5 particles
    expect(e.activeCount).toBeGreaterThanOrEqual(4);
  });

  it("remove removes emitter", () => {
    const e = ps.create();
    ps.remove(e);
    expect(ps.emitters).not.toContain(e);
  });

  it("destroy clears all emitters", () => {
    ps.create();
    ps.create();
    ps.destroy();
    expect(ps.emitters).toHaveLength(0);
  });

  // Code-first parity: a fully-specified ParticleEmitterOptions object — the
  // exact shape the ParticleEditor IDE panel now stores in particleStore —
  // must construct a working emitter with zero translation.
  it("accepts a fully-specified ParticleEmitterOptions with no translation", () => {
    const options: ParticleEmitterOptions = {
      texture: "spark.png",
      emissionRate: 15,
      lifetime: { min: 0.4, max: 0.9 },
      velocity: { x: { min: -20, max: 20 }, y: { min: -80, max: -40 } },
      acceleration: { x: 5, y: 150 },
      startScale: 0.8,
      endScale: 0.2,
      startAlpha: 1,
      endAlpha: 0,
      colorGradient: [0xffcc00, 0xff5500, 0x330000],
      shape: "rectangle",
      shapeWidth: 40,
      shapeHeight: 10,
      rotationSpeed: 2,
      maxParticles: 250,
    };
    const e = new ParticleEmitter(options);
    e.x = 100;
    e.y = 50;
    e.emit(1);
    expect(e.activeCount).toBe(1);
    const [p] = e.getParticles();
    if (p === undefined) throw new Error("expected a spawned particle");
    expect(p.x).toBeGreaterThanOrEqual(100 - 20);
    expect(p.x).toBeLessThanOrEqual(100 + 20);
    expect(p.y).toBeGreaterThanOrEqual(50 - 5);
    expect(p.y).toBeLessThanOrEqual(50 + 5);
    expect(e.options).toEqual({ ...options, shapeRadius: 0 });
  });
});

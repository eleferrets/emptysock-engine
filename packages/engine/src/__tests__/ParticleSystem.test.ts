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
    expect(e.options).toEqual({
      ...options,
      shapeRadius: 0,
      sizeWiggle: 0,
      speedWiggle: 0,
      dirWiggle: 0,
      blendMode: "normal",
    });
  });

  describe("wiggle", () => {
    it("size wiggle varies a particle's scale step-to-step beyond the deterministic ramp", () => {
      const e = new ParticleEmitter({
        emissionRate: 0,
        lifetime: { min: 10, max: 10 },
        startScale: 1,
        endScale: 1, // flat ramp — any scale variation must come from wiggle alone
        sizeWiggle: 0.5,
      });
      e.emit(1);
      const scales: number[] = [];
      for (let i = 0; i < 10; i++) {
        e.update(0.1);
        const [p] = e.getParticles();
        if (p === undefined) throw new Error("expected a live particle");
        scales.push(p.scale);
        // Bounded: base scale (1) +/- sizeWiggle (0.5), clamped at 0.
        expect(p.scale).toBeGreaterThanOrEqual(0);
        expect(p.scale).toBeLessThanOrEqual(1.5);
      }
      const distinct = new Set(scales);
      expect(distinct.size).toBeGreaterThan(1);
    });

    it("speed wiggle varies a particle's velocity magnitude step-to-step", () => {
      const e = new ParticleEmitter({
        emissionRate: 0,
        lifetime: { min: 10, max: 10 },
        velocity: { x: { min: 100, max: 100 }, y: { min: 0, max: 0 } },
        acceleration: { x: 0, y: 0 },
        speedWiggle: 20,
      });
      e.emit(1);
      const speeds: number[] = [];
      // Wiggle perturbs the *current* velocity every step (a real
      // step-to-step random walk, matching GameMaker's own semantic, not a
      // bounded jitter around the emitter's original spawn speed), so only
      // a single-step bound is meaningful — assert that, plus real
      // step-to-step variation over the run.
      let lastSpeed = 100;
      for (let i = 0; i < 10; i++) {
        e.update(0.1);
        const [p] = e.getParticles();
        if (p === undefined) throw new Error("expected a live particle");
        const speed = Math.hypot(p.vx, p.vy);
        expect(speed).toBeGreaterThanOrEqual(0);
        expect(speed).toBeLessThanOrEqual(lastSpeed + 20);
        speeds.push(speed);
        lastSpeed = speed;
      }
      const distinct = new Set(speeds.map((s) => Math.round(s)));
      expect(distinct.size).toBeGreaterThan(1);
    });

    it("direction wiggle varies a particle's travel angle step-to-step", () => {
      const e = new ParticleEmitter({
        emissionRate: 0,
        lifetime: { min: 10, max: 10 },
        velocity: { x: { min: 100, max: 100 }, y: { min: 0, max: 0 } },
        acceleration: { x: 0, y: 0 },
        dirWiggle: 30,
      });
      e.emit(1);
      const angles: number[] = [];
      for (let i = 0; i < 10; i++) {
        e.update(0.1);
        const [p] = e.getParticles();
        if (p === undefined) throw new Error("expected a live particle");
        angles.push(Math.atan2(p.vy, p.vx));
      }
      const distinct = new Set(angles.map((a) => Math.round(a * 1000)));
      expect(distinct.size).toBeGreaterThan(1);
    });

    it("zero wiggle (the default) never perturbs scale or velocity", () => {
      const e = new ParticleEmitter({
        emissionRate: 0,
        lifetime: { min: 10, max: 10 },
        velocity: { x: { min: 50, max: 50 }, y: { min: 0, max: 0 } },
        acceleration: { x: 0, y: 0 },
        startScale: 1,
        endScale: 1,
      });
      e.emit(1);
      e.update(0.1);
      const [p] = e.getParticles();
      if (p === undefined) throw new Error("expected a live particle");
      expect(p.scale).toBe(1);
      expect(p.vx).toBe(50);
      expect(p.vy).toBe(0);
    });
  });

  describe("blend mode", () => {
    it("defaults to normal blend", () => {
      const e = new ParticleEmitter();
      expect(e.options.blendMode).toBe("normal");
    });

    it("accepts an explicit additive blend mode", () => {
      const e = new ParticleEmitter({ blendMode: "add" });
      expect(e.options.blendMode).toBe("add");
    });
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { ParticleSystem } from '../systems/ParticleSystem.js';

let ps: ParticleSystem;
beforeEach(() => { ps = new ParticleSystem(); });

describe('ParticleSystem', () => {
  it('creates an emitter and tracks it', () => {
    const e = ps.create({ emissionRate: 10, lifetime: { min: 1, max: 1 } });
    expect(ps.emitters).toContain(e);
  });

  it('burst emit spawns correct count', () => {
    const e = ps.create({ emissionRate: 0 });
    e.active = false;
    e.emit(5);
    expect(e.activeCount).toBe(5);
  });

  it('particles die after their lifetime', () => {
    const e = ps.create({ emissionRate: 0, lifetime: { min: 0.1, max: 0.1 } });
    e.emit(3);
    ps.update(0.05);
    expect(e.activeCount).toBe(3);
    ps.update(0.1);
    expect(e.activeCount).toBe(0);
  });

  it('continuous emission accumulates particles over time', () => {
    const e = ps.create({ emissionRate: 10, lifetime: { min: 5, max: 5 }, maxParticles: 100 });
    ps.update(0.5); // should emit ~5 particles
    expect(e.activeCount).toBeGreaterThanOrEqual(4);
  });

  it('remove removes emitter', () => {
    const e = ps.create();
    ps.remove(e);
    expect(ps.emitters).not.toContain(e);
  });

  it('destroy clears all emitters', () => {
    ps.create();
    ps.create();
    ps.destroy();
    expect(ps.emitters).toHaveLength(0);
  });
});

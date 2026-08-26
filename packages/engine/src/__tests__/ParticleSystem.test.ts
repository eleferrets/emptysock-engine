import { describe, it, expect, beforeEach } from 'vitest';
import { ParticleSystem } from '../systems/ParticleSystem.js';

beforeEach(() => { ParticleSystem.clear(); });

describe('ParticleSystem', () => {
  it('creates an emitter and tracks it', () => {
    const e = ParticleSystem.create({ emissionRate: 10, lifetime: { min: 1, max: 1 } });
    expect(ParticleSystem.emitters).toContain(e);
  });

  it('burst emit spawns correct count', () => {
    const e = ParticleSystem.create({ emissionRate: 0 });
    e.active = false;
    e.emit(5);
    expect(e.activeCount).toBe(5);
  });

  it('particles die after their lifetime', () => {
    const e = ParticleSystem.create({ emissionRate: 0, lifetime: { min: 0.1, max: 0.1 } });
    e.emit(3);
    ParticleSystem.update(0.05);
    expect(e.activeCount).toBe(3);
    ParticleSystem.update(0.1);
    expect(e.activeCount).toBe(0);
  });

  it('continuous emission accumulates particles over time', () => {
    const e = ParticleSystem.create({ emissionRate: 10, lifetime: { min: 5, max: 5 }, maxParticles: 100 });
    ParticleSystem.update(0.5); // should emit ~5 particles
    expect(e.activeCount).toBeGreaterThanOrEqual(4);
  });

  it('destroy removes emitter', () => {
    const e = ParticleSystem.create();
    ParticleSystem.destroy(e);
    expect(ParticleSystem.emitters).not.toContain(e);
  });
});

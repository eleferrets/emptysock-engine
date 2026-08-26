import { describe, it, expect } from 'vitest';
import { PhysicsBody } from '../components/PhysicsBody.js';

describe('PhysicsBody', () => {
  it('defaults to dynamic box', () => {
    const pb = new PhysicsBody();
    expect(pb.bodyType).toBe('dynamic');
    expect(pb.shape).toBe('box');
    expect(pb.density).toBe(1);
    expect(pb.isSensor).toBe(false);
    expect(pb.bodyHandle).toBeNull();
    expect(pb.colliderHandle).toBeNull();
  });

  it('accepts constructor options', () => {
    const pb = new PhysicsBody({ bodyType: 'fixed', shape: 'circle', radius: 20, density: 2, isSensor: true });
    expect(pb.bodyType).toBe('fixed');
    expect(pb.shape).toBe('circle');
    expect(pb.radius).toBe(20);
    expect(pb.density).toBe(2);
    expect(pb.isSensor).toBe(true);
  });

  it('serialize includes bodyType and shape', () => {
    const pb = new PhysicsBody({ bodyType: 'kinematicPositionBased', friction: 0.8 });
    const s = pb.serialize();
    expect(s.bodyType).toBe('kinematicPositionBased');
    expect(s.friction).toBe(0.8);
    expect(s.type).toBe('PhysicsBody');
  });
});

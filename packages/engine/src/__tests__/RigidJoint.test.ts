import { describe, it, expect } from 'vitest';
import { RigidJoint } from '../components/RigidJoint.js';

describe('RigidJoint', () => {
  it('defaults to fixed joint with no body B', () => {
    const joint = new RigidJoint();
    expect(joint.jointType).toBe('fixed');
    expect(joint.bodyBEntityId).toBeNull();
    expect(joint.jointHandle).toBeNull();
  });

  it('stores revolute options', () => {
    const joint = new RigidJoint({
      jointType: 'revolute',
      bodyBEntityId: 5,
      revolute: { anchorA: { x: 0, y: 0 }, minAngle: -1, maxAngle: 1 },
    });
    expect(joint.jointType).toBe('revolute');
    expect(joint.bodyBEntityId).toBe(5);
    expect(joint.revolute.minAngle).toBe(-1);
  });

  it('serializes joint type and body reference', () => {
    const joint = new RigidJoint({ jointType: 'spring', bodyBEntityId: 10 });
    const data = joint.serialize();
    expect(data['jointType']).toBe('spring');
    expect(data['bodyBEntityId']).toBe(10);
  });

  it('has component type RigidJoint', () => {
    const joint = new RigidJoint();
    expect(joint.type).toBe('RigidJoint');
  });
});

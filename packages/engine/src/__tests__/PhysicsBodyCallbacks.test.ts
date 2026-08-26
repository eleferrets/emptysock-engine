import { describe, it, expect, vi } from 'vitest';
import { PhysicsBody } from '../components/PhysicsBody.js';

describe('PhysicsBody callbacks', () => {
  it('dispatchCollisionEnter calls registered callback', () => {
    const a = new PhysicsBody();
    const b = new PhysicsBody();
    const fn = vi.fn();
    a.onCollisionEnter(fn);
    a.dispatchCollisionEnter(b, { impactForce: 5 });
    expect(fn).toHaveBeenCalledWith(b, { impactForce: 5 });
  });

  it('dispatchSensorEnter and dispatchSensorExit fire correctly', () => {
    const sensor = new PhysicsBody({ isSensor: true });
    const other = new PhysicsBody();
    const enter = vi.fn();
    const exit = vi.fn();
    sensor.onSensorEnter(enter);
    sensor.onSensorExit(exit);
    sensor.dispatchSensorEnter(other);
    sensor.dispatchSensorExit(other);
    expect(enter).toHaveBeenCalledWith(other);
    expect(exit).toHaveBeenCalledWith(other);
  });

  it('no crash when no callback registered', () => {
    const a = new PhysicsBody();
    const b = new PhysicsBody();
    expect(() => a.dispatchCollisionEnter(b, { impactForce: 0 })).not.toThrow();
    expect(() => a.dispatchSensorEnter(b)).not.toThrow();
  });

  it('dispatchSensorStay fires onSensorStay', () => {
    const a = new PhysicsBody({ isSensor: true });
    const b = new PhysicsBody();
    const fn = vi.fn();
    a.onSensorStay(fn);
    a.dispatchSensorStay(b);
    expect(fn).toHaveBeenCalledWith(b);
  });
});

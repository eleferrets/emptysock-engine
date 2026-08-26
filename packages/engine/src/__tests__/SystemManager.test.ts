import { describe, it, expect } from 'vitest';
import { SystemManager } from '../core/SystemManager.js';

describe('SystemManager', () => {
  it('registers and retrieves a system', () => {
    const sm = new SystemManager();
    const sys = { update: () => {} };
    sm.register('test', sys);
    expect(sm.get('test')).toBe(sys);
  });

  it('get returns undefined for unknown name', () => {
    const sm = new SystemManager();
    expect(sm.get('missing')).toBeUndefined();
  });

  it('unregister removes the system', () => {
    const sm = new SystemManager();
    sm.register('s', { update: () => {} });
    sm.unregister('s');
    expect(sm.get('s')).toBeUndefined();
  });

  it('updateAll calls update on all systems with dt', () => {
    const sm = new SystemManager();
    const calls: number[] = [];
    sm.register('a', { update: (dt) => calls.push(dt) });
    sm.register('b', { update: (dt) => calls.push(dt * 2) });
    sm.updateAll(0.016);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toBeCloseTo(0.016);
    expect(calls[1]).toBeCloseTo(0.032);
  });

  it('updateAll with no systems does not throw', () => {
    const sm = new SystemManager();
    expect(() => sm.updateAll(1)).not.toThrow();
  });
});

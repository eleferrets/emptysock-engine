import { describe, it, expect } from 'vitest';
import { LightingSystem } from '../systems/LightingSystem.js';

describe('LightingSystem', () => {
  it('starts with no lights and default ambient', () => {
    const ls = new LightingSystem();
    expect(ls.lights.size).toBe(0);
    expect(ls.ambientColour).toBe(0xffffff);
    expect(ls.ambientIntensity).toBeCloseTo(0.2);
  });

  it('addLight stores the light by id', () => {
    const ls = new LightingSystem();
    ls.addLight({ id: 'sun', type: 'directional', colour: 0xffffff, intensity: 1, castShadows: true });
    expect(ls.lights.has('sun')).toBe(true);
    expect(ls.lights.get('sun')?.type).toBe('directional');
  });

  it('removeLight returns true and removes entry', () => {
    const ls = new LightingSystem();
    ls.addLight({ id: 'torch', type: 'point', colour: 0xff8800, intensity: 0.8, radius: 200, castShadows: false });
    expect(ls.removeLight('torch')).toBe(true);
    expect(ls.lights.has('torch')).toBe(false);
  });

  it('removeLight returns false for unknown id', () => {
    const ls = new LightingSystem();
    expect(ls.removeLight('ghost')).toBe(false);
  });

  it('setAmbient updates colour and intensity', () => {
    const ls = new LightingSystem();
    ls.setAmbient(0x334455, 0.5);
    expect(ls.ambientColour).toBe(0x334455);
    expect(ls.ambientIntensity).toBeCloseTo(0.5);
  });

  it('update does not throw', () => {
    const ls = new LightingSystem();
    expect(() => ls.update(0.016)).not.toThrow();
  });
});

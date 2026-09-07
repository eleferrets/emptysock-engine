import { describe, it, expect, beforeEach } from 'vitest';
import { PostProcessSystem } from '../systems/PostProcessSystem.js';

let pp: PostProcessSystem;
beforeEach(() => { pp = new PostProcessSystem(); });

describe('PostProcessSystem', () => {
  it('adds and retrieves an effect', () => {
    pp.add('bloom', { threshold: 0.7, strength: 1.5 });
    expect(pp.has('bloom')).toBe(true);
    const e = pp.get('bloom');
    expect(e?.type).toBe('bloom');
  });

  it('replace effect when added again', () => {
    pp.add('vignette', { intensity: 0.3 });
    pp.add('vignette', { intensity: 0.6 });
    expect(pp.effects.filter(e => e.type === 'vignette').length).toBe(1);
  });

  it('remove deletes effect', () => {
    pp.add('blur');
    pp.remove('blur');
    expect(pp.has('blur')).toBe(false);
  });

  it('flash is active for its duration', () => {
    pp.flash({ duration: 0.2, colour: 0xff0000 });
    pp.update(0.1);
    expect(pp.flashActive).toBe(true);
    pp.update(0.15);
    expect(pp.flashActive).toBe(false);
  });

  it('beginTransition sets effect and endTransition clears it', () => {
    pp.beginTransition('fade', 0x000000);
    expect(pp.transitionEffect).toBe('fade');
    pp.endTransition();
    expect(pp.transitionEffect).toBe('none');
  });

  it('destroy resets all state', () => {
    pp.add('bloom');
    pp.setLayerFilter('fg', { type: 'blur', radius: 4 });
    pp.destroy();
    expect(pp.effects).toHaveLength(0);
    expect(pp.layerFilters.size).toBe(0);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { PostProcessSystem } from '../systems/PostProcessSystem.js';

beforeEach(() => { PostProcessSystem.clear(); });

describe('PostProcessSystem', () => {
  it('adds and retrieves an effect', () => {
    PostProcessSystem.add('bloom', { threshold: 0.7, strength: 1.5 });
    expect(PostProcessSystem.has('bloom')).toBe(true);
    const e = PostProcessSystem.get('bloom');
    expect(e?.type).toBe('bloom');
  });

  it('replace effect when added again', () => {
    PostProcessSystem.add('vignette', { intensity: 0.3 });
    PostProcessSystem.add('vignette', { intensity: 0.6 });
    expect(PostProcessSystem.effects.filter(e => e.type === 'vignette').length).toBe(1);
  });

  it('remove deletes effect', () => {
    PostProcessSystem.add('blur');
    PostProcessSystem.remove('blur');
    expect(PostProcessSystem.has('blur')).toBe(false);
  });

  it('flash is active for its duration', () => {
    PostProcessSystem.flash({ duration: 0.2, colour: 0xff0000 });
    PostProcessSystem.update(0.1);
    expect(PostProcessSystem.flashActive).toBe(true);
    PostProcessSystem.update(0.15);
    expect(PostProcessSystem.flashActive).toBe(false);
  });

  it('beginTransition sets effect and endTransition clears it', () => {
    PostProcessSystem.beginTransition('fade', 0x000000);
    expect(PostProcessSystem.transitionEffect).toBe('fade');
    PostProcessSystem.endTransition();
    expect(PostProcessSystem.transitionEffect).toBe('none');
  });
});

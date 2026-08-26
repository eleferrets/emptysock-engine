import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock howler before importing AudioSystem
vi.mock('howler', () => {
  const Howl = vi.fn().mockImplementation(() => ({
    play: vi.fn().mockReturnValue(1),
    stop: vi.fn(),
    pause: vi.fn(),
    unload: vi.fn(),
  }));
  const Howler = { volume: vi.fn() };
  return { Howl, Howler };
});

import { AudioSystem } from '../systems/AudioSystem.js';

describe('AudioSystem', () => {
  let audio: AudioSystem;

  beforeEach(() => {
    audio = new AudioSystem();
  });

  it('masterVolume defaults to 1', () => {
    expect(audio.masterVolume).toBe(1);
  });

  it('setting masterVolume clamps to [0,1]', () => {
    audio.masterVolume = 2;
    expect(audio.masterVolume).toBe(1);
    audio.masterVolume = -1;
    expect(audio.masterVolume).toBe(0);
  });

  it('load returns a Howl instance', async () => {
    const { Howl } = await import('howler');
    const howl = audio.load('jump', 'assets/jump.ogg');
    expect(Howl).toHaveBeenCalled();
    expect(howl).toBeDefined();
  });

  it('play returns a sound id', () => {
    audio.load('jump', 'assets/jump.ogg');
    const id = audio.play('jump');
    expect(id).toBe(1);
  });

  it('play returns null for unknown id', () => {
    const id = audio.play('ghost');
    expect(id).toBeNull();
  });

  it('setGroupVolume and getGroupVolume round-trip', () => {
    audio.setGroupVolume('sfx', 0.5);
    expect(audio.getGroupVolume('sfx')).toBeCloseTo(0.5);
  });

  it('getGroupVolume returns 1 for unknown group', () => {
    expect(audio.getGroupVolume('unknown')).toBe(1);
  });

  it('unloadAll clears all sounds', () => {
    audio.load('a', 'a.ogg');
    audio.load('b', 'b.ogg');
    audio.unloadAll();
    expect(audio.play('a')).toBeNull();
  });
});

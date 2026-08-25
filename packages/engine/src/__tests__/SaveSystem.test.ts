import { describe, it, expect, beforeEach } from 'vitest';
import { SaveSystem } from '../systems/SaveSystem.js';

// Mock localStorage
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string): string | null => store[key] ?? null,
  setItem: (key: string, val: string): void => { store[key] = val; },
  removeItem: (key: string): void => { delete store[key]; },
  clear: (): void => { for (const k of Object.keys(store)) delete store[k]; },
  get length() { return Object.keys(store).length; },
  key: (i: number): string | null => Object.keys(store)[i] ?? null,
};

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

describe('SaveSystem', () => {
  let sys: SaveSystem;

  beforeEach(() => {
    localStorageMock.clear();
    sys = new SaveSystem('test_save_');
  });

  it('save and load returns the slot', () => {
    sys.save('slot1', { scene: 'GameScene', data: { hp: 50 }, timestamp: 1000, playtime: 30 });
    const slot = sys.load('slot1');
    expect(slot).not.toBeNull();
    expect(slot?.scene).toBe('GameScene');
    expect(slot?.data['hp']).toBe(50);
  });

  it('load returns null for missing slot', () => {
    expect(sys.load('nonexistent')).toBeNull();
  });

  it('listSlots returns all saved slots', () => {
    sys.save('a', { scene: 'S1', data: {}, timestamp: 1, playtime: 0 });
    sys.save('b', { scene: 'S2', data: {}, timestamp: 2, playtime: 10 });
    const slots = sys.listSlots();
    expect(slots.length).toBe(2);
  });

  it('delete removes slot', () => {
    sys.save('del', { scene: 'X', data: {}, timestamp: 1, playtime: 0 });
    sys.delete('del');
    expect(sys.load('del')).toBeNull();
    expect(sys.listSlots().length).toBe(0);
  });
});

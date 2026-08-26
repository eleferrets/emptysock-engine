import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GamepadSystem } from '../systems/GamepadSystem.js';

// jsdom does not implement navigator.getGamepads — install a stub
function mockGamepads(pads: (Partial<Gamepad> | null)[]): void {
  Object.defineProperty(navigator, 'getGamepads', {
    value: () => pads,
    configurable: true,
    writable: true,
  });
}

describe('GamepadSystem', () => {
  let sys: GamepadSystem;

  beforeEach(() => {
    sys = new GamepadSystem();
    mockGamepads([null, null, null, null]);
  });

  it('getState returns null when no pad at index', () => {
    sys.update();
    expect(sys.getState(0)).toBeNull();
  });

  it('getState returns state for connected pad after update', () => {
    mockGamepads([{
      connected: true,
      buttons: [
        { pressed: true, touched: false, value: 1 },
        { pressed: false, touched: false, value: 0 },
      ] as GamepadButton[],
      axes: [0.5, -0.3],
      index: 0,
    } as Gamepad]);
    sys.update();
    const state = sys.getState(0);
    expect(state).not.toBeNull();
    expect(state?.connected).toBe(true);
    expect(state?.buttons[0]).toBe(true);
    expect(state?.buttons[1]).toBe(false);
    expect(state?.axes[0]).toBeCloseTo(0.5);
  });

  it('getState returns null for out-of-range index', () => {
    sys.update();
    expect(sys.getState(99)).toBeNull();
  });

  it('rumble does not throw when pad slot is null', () => {
    expect(() => sys.rumble(0, 0.5, 200)).not.toThrow();
  });

  it('rumbleDual does not throw when pad slot is null', () => {
    expect(() => sys.rumbleDual(0, { weakMagnitude: 0.3, strongMagnitude: 0.7, duration: 100 })).not.toThrow();
  });

  it('rumble calls vibrationActuator when available', () => {
    const playEffect = vi.fn();
    mockGamepads([{
      connected: true,
      buttons: [] as unknown as GamepadButton[],
      axes: [],
      index: 0,
      vibrationActuator: { playEffect },
    } as unknown as Gamepad]);
    sys.rumble(0, 0.8, 300);
    expect(playEffect).toHaveBeenCalledWith('dual-rumble', expect.objectContaining({ weakMagnitude: 0.8 }));
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InputSystem } from '../systems/InputSystem.js';

function fireKeydown(target: EventTarget, code: string): void {
  target.dispatchEvent(Object.assign(new Event('keydown'), { code }));
}

function fireKeyup(target: EventTarget, code: string): void {
  target.dispatchEvent(Object.assign(new Event('keyup'), { code }));
}

describe('InputSystem', () => {
  let input: InputSystem;
  let target: EventTarget;

  beforeEach(() => {
    target = new EventTarget();
    input = new InputSystem();
    input.attach(target);
  });

  afterEach(() => {
    input.detach();
  });

  it('isKeyDown returns false initially', () => {
    expect(input.isKeyDown('KeyA')).toBe(false);
  });

  it('isKeyDown returns true after keydown', () => {
    fireKeydown(target, 'KeyA');
    expect(input.isKeyDown('KeyA')).toBe(true);
  });

  it('isKeyPressed returns true only on first frame', () => {
    fireKeydown(target, 'KeyB');
    expect(input.isKeyPressed('KeyB')).toBe(true);
    input.flush();
    expect(input.isKeyPressed('KeyB')).toBe(false);
  });

  it('isKeyReleased returns true frame after keyup', () => {
    fireKeydown(target, 'KeyC');
    input.flush();
    fireKeyup(target, 'KeyC');
    expect(input.isKeyReleased('KeyC')).toBe(true);
    input.flush();
    expect(input.isKeyReleased('KeyC')).toBe(false);
  });

  it('isKeyDown returns false after keyup', () => {
    fireKeydown(target, 'Space');
    input.flush();
    fireKeyup(target, 'Space');
    expect(input.isKeyDown('Space')).toBe(false);
  });
});

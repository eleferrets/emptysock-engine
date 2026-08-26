import { describe, it, expect } from 'vitest';
import { CharacterController } from '../components/CharacterController.js';

describe('CharacterController', () => {
  it('defaults to sensible values', () => {
    const cc = new CharacterController();
    expect(cc.speed).toBe(200);
    expect(cc.jumpForce).toBe(400);
    expect(cc.isGrounded).toBe(false);
    expect(cc.snapToGround).toBeCloseTo(0.1);
    expect(cc.maxSlopeAngle).toBe(45);
  });

  it('accepts constructor options', () => {
    const cc = new CharacterController({ speed: 300, jumpForce: 600, maxSlopeAngle: 30 });
    expect(cc.speed).toBe(300);
    expect(cc.jumpForce).toBe(600);
    expect(cc.maxSlopeAngle).toBe(30);
  });

  it('isGrounded is mutable', () => {
    const cc = new CharacterController();
    cc.isGrounded = true;
    expect(cc.isGrounded).toBe(true);
  });

  it('serialize includes speed and jumpForce', () => {
    const cc = new CharacterController({ speed: 150 });
    const s = cc.serialize();
    expect(s.speed).toBe(150);
    expect(s.type).toBe('CharacterController');
  });
});

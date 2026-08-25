import { Component } from '../core/Component.js';

export class CharacterController extends Component {
  public speed: number;
  public jumpForce: number;
  public isGrounded: boolean = false;
  public snapToGround: number;
  public maxSlopeAngle: number;

  constructor(options: {
    speed?: number;
    jumpForce?: number;
    snapToGround?: number;
    maxSlopeAngle?: number;
  } = {}) {
    super('CharacterController');
    this.speed = options.speed ?? 200;
    this.jumpForce = options.jumpForce ?? 400;
    this.snapToGround = options.snapToGround ?? 0.1;
    this.maxSlopeAngle = options.maxSlopeAngle ?? 45;
  }

  override serialize(): Record<string, unknown> {
    return {
      ...super.serialize(),
      speed: this.speed,
      jumpForce: this.jumpForce,
      snapToGround: this.snapToGround,
      maxSlopeAngle: this.maxSlopeAngle,
    };
  }
}

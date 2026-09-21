import { Component, type ComponentType } from "../core/Component.js";
export declare class CharacterController extends Component {
  static readonly TYPE: ComponentType<CharacterController>;
  speed: number;
  jumpForce: number;
  isGrounded: boolean;
  snapToGround: number;
  maxSlopeAngle: number;
  constructor(options?: {
    speed?: number;
    jumpForce?: number;
    snapToGround?: number;
    maxSlopeAngle?: number;
  });
  serialize(): Record<string, unknown>;
}

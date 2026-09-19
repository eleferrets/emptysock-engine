import { Behavior, type BehaviorContext } from "./Behavior.js";
import type { InputSystem } from "../systems/InputSystem.js";
/**
 * PlatformBehavior — side-scrolling platformer movement driven by InputSystem.
 * Moves the entity's Transform directly; does not integrate with PhysicsSystem.
 * Use PhysicsSystem for collision-accurate platformers.
 */
export declare class PlatformBehavior extends Behavior {
  speed: number;
  jumpStrength: number;
  gravity: number;
  private _velocityY;
  private _onGround;
  private readonly _input;
  constructor(
    input: InputSystem,
    speed?: number,
    jumpStrength?: number,
    gravity?: number,
  );
  update(ctx: BehaviorContext): void;
}

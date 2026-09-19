import { Behavior, type BehaviorContext } from "./Behavior.js";
import type { InputSystem } from "../systems/InputSystem.js";
/**
 * EightDirBehavior — moves an entity in 8 directions using arrow keys or WASD.
 * Requires a Transform component on the entity and an InputSystem instance.
 */
export declare class EightDirBehavior extends Behavior {
  speed: number;
  /** Speed multiplier when moving diagonally (default: 1/√2 ≈ 0.707). */
  diagonalSpeed: number;
  private readonly _input;
  constructor(input: InputSystem, speed?: number);
  update(ctx: BehaviorContext): void;
}

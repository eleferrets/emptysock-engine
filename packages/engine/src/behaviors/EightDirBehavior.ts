import { Behavior, type BehaviorContext } from "./Behavior.js";
import type { Transform } from "../components/Transform.js";
import type { InputSystem } from "../systems/InputSystem.js";

/**
 * EightDirBehavior — moves an entity in 8 directions using arrow keys or WASD.
 * Requires a Transform component on the entity and an InputSystem instance.
 */
export class EightDirBehavior extends Behavior {
  public speed: number;
  /** Speed multiplier when moving diagonally (default: 1/√2 ≈ 0.707). */
  public diagonalSpeed: number;
  private readonly _input: InputSystem;

  constructor(input: InputSystem, speed = 200) {
    super();
    this._input = input;
    this.speed = speed;
    this.diagonalSpeed = speed * 0.707;
  }

  update(ctx: BehaviorContext): void {
    const transform = ctx.entity.getComponent<Transform>("Transform");
    if (transform === undefined) return;

    const left =
      this._input.isKeyDown("ArrowLeft") || this._input.isKeyDown("KeyA");
    const right =
      this._input.isKeyDown("ArrowRight") || this._input.isKeyDown("KeyD");
    const up =
      this._input.isKeyDown("ArrowUp") || this._input.isKeyDown("KeyW");
    const down =
      this._input.isKeyDown("ArrowDown") || this._input.isKeyDown("KeyS");

    let dx = 0;
    let dy = 0;
    if (left) dx -= 1;
    if (right) dx += 1;
    if (up) dy -= 1;
    if (down) dy += 1;

    if (dx === 0 && dy === 0) return;

    const diagonal = dx !== 0 && dy !== 0;
    const spd = diagonal ? this.diagonalSpeed : this.speed;

    transform.x += dx * spd * ctx.dt;
    transform.y += dy * spd * ctx.dt;
  }
}

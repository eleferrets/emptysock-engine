import { Behavior, type BehaviorContext } from "./Behavior.js";
import type { Transform } from "../components/Transform.js";
import type { InputSystem } from "../systems/InputSystem.js";

/**
 * PlatformBehavior — side-scrolling platformer movement driven by InputSystem.
 * Moves the entity's Transform directly; does not integrate with PhysicsSystem.
 * Use PhysicsSystem for collision-accurate platformers.
 */
export class PlatformBehavior extends Behavior {
  public speed: number;
  public jumpStrength: number;
  public gravity: number;
  private _velocityY: number = 0;
  private _onGround: boolean = false;
  private readonly _input: InputSystem;

  constructor(
    input: InputSystem,
    speed = 150,
    jumpStrength = 400,
    gravity = 800,
  ) {
    super();
    this._input = input;
    this.speed = speed;
    this.jumpStrength = jumpStrength;
    this.gravity = gravity;
  }

  update(ctx: BehaviorContext): void {
    const transform = ctx.entity.getComponent<Transform>("Transform");
    if (transform === undefined) return;

    const left =
      this._input.isKeyDown("ArrowLeft") || this._input.isKeyDown("KeyA");
    const right =
      this._input.isKeyDown("ArrowRight") || this._input.isKeyDown("KeyD");
    const jump =
      this._input.isKeyPressed("ArrowUp") ||
      this._input.isKeyPressed("KeyW") ||
      this._input.isKeyPressed("Space");

    if (left) transform.x -= this.speed * ctx.dt;
    if (right) transform.x += this.speed * ctx.dt;

    if (jump && this._onGround) {
      this._velocityY = -this.jumpStrength;
      this._onGround = false;
    }

    this._velocityY += this.gravity * ctx.dt;
    transform.y += this._velocityY * ctx.dt;

    // Simple ground plane at y=0 — real collision requires PhysicsSystem
    if (transform.y >= 0) {
      transform.y = 0;
      this._velocityY = 0;
      this._onGround = true;
    }
  }
}

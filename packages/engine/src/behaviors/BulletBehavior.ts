import { Behavior, type BehaviorContext } from "./Behavior.js";
import type { Transform } from "../components/Transform.js";

/**
 * BulletBehavior — moves an entity at a constant angle each frame.
 * When destroyOutside is true and the entity leaves the bounding rect,
 * it is removed from the scene.
 */
export class BulletBehavior extends Behavior {
  public speed: number;
  /** Angle in radians (0 = right). */
  public angle: number;
  public destroyOutside: boolean;

  private readonly _boundsX: number;
  private readonly _boundsY: number;
  private readonly _boundsWidth: number;
  private readonly _boundsHeight: number;

  constructor(
    options: {
      speed?: number;
      angle?: number;
      destroyOutside?: boolean;
      boundsX?: number;
      boundsY?: number;
      boundsWidth?: number;
      boundsHeight?: number;
    } = {},
  ) {
    super();
    this.speed = options.speed ?? 300;
    this.angle = options.angle ?? 0;
    this.destroyOutside = options.destroyOutside ?? true;
    this._boundsX = options.boundsX ?? 0;
    this._boundsY = options.boundsY ?? 0;
    this._boundsWidth = options.boundsWidth ?? 1920;
    this._boundsHeight = options.boundsHeight ?? 1080;
  }

  update(ctx: BehaviorContext): void {
    const transform = ctx.entity.getComponent<Transform>("Transform");
    if (transform === undefined) return;

    transform.x += Math.cos(this.angle) * this.speed * ctx.dt;
    transform.y += Math.sin(this.angle) * this.speed * ctx.dt;

    if (this.destroyOutside) {
      const outside =
        transform.x < this._boundsX - this._boundsWidth / 2 ||
        transform.x > this._boundsX + this._boundsWidth * 1.5 ||
        transform.y < this._boundsY - this._boundsHeight / 2 ||
        transform.y > this._boundsY + this._boundsHeight * 1.5;
      if (outside && ctx.scene !== undefined) {
        ctx.scene.removeEntity(ctx.entity);
      }
    }
  }
}

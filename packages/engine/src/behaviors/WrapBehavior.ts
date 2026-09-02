import { Behavior, type BehaviorContext } from "./Behavior.js";
import type { Transform } from "../components/Transform.js";

/**
 * WrapBehavior — wraps an entity's position around the viewport edges.
 * Pass the canvas width and height to the constructor.
 */
export class WrapBehavior extends Behavior {
  public margin: number;
  private readonly _width: number;
  private readonly _height: number;

  constructor(width: number, height: number, margin = 32) {
    super();
    this._width = width;
    this._height = height;
    this.margin = margin;
  }

  update(ctx: BehaviorContext): void {
    const transform = ctx.entity.getComponent<Transform>("Transform");
    if (transform === undefined) return;

    if (transform.x < -this.margin) {
      transform.x = this._width + this.margin;
    } else if (transform.x > this._width + this.margin) {
      transform.x = -this.margin;
    }

    if (transform.y < -this.margin) {
      transform.y = this._height + this.margin;
    } else if (transform.y > this._height + this.margin) {
      transform.y = -this.margin;
    }
  }
}

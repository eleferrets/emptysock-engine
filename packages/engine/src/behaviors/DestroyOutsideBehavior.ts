import { Behavior, type BehaviorContext } from "./Behavior.js";
import type { Transform } from "../components/Transform.js";

/**
 * DestroyOutsideBehavior — removes the entity from the scene when its
 * Transform position leaves the layout bounds (plus optional margin).
 */
export class DestroyOutsideBehavior extends Behavior {
  public margin: number;
  private readonly _x: number;
  private readonly _y: number;
  private readonly _width: number;
  private readonly _height: number;

  constructor(
    options: {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      margin?: number;
    } = {},
  ) {
    super();
    this._x = options.x ?? 0;
    this._y = options.y ?? 0;
    this._width = options.width ?? 1920;
    this._height = options.height ?? 1080;
    this.margin = options.margin ?? 0;
  }

  update(ctx: BehaviorContext): void {
    const transform = ctx.entity.getComponent<Transform>("Transform");
    if (transform === undefined) return;

    const outside =
      transform.x < this._x - this.margin ||
      transform.x > this._x + this._width + this.margin ||
      transform.y < this._y - this.margin ||
      transform.y > this._y + this._height + this.margin;

    if (outside) {
      ctx.scene.removeEntity(ctx.entity);
    }
  }
}

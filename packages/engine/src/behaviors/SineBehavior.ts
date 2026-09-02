import { Behavior, type BehaviorContext } from "./Behavior.js";
import type { Transform } from "../components/Transform.js";

export type SineType = "position" | "scale" | "opacity";
export type SineAxis = "x" | "y";

/**
 * SineBehavior — oscillates a Transform property on a sine wave.
 * Saves the entity's origin values at attach time and applies an offset
 * each frame. Opacity requires a component named 'Sprite' with an
 * `alpha` property (standard EmptySock Sprite component).
 */
export class SineBehavior extends Behavior {
  public type: SineType;
  public axis: SineAxis;
  public magnitude: number;
  /** Period in seconds (time for one full cycle). */
  public period: number;

  private _elapsed: number = 0;
  private _originX: number = 0;
  private _originY: number = 0;
  private _originScaleX: number = 1;
  private _originScaleY: number = 1;

  constructor(
    options: {
      type?: SineType;
      axis?: SineAxis;
      magnitude?: number;
      period?: number;
    } = {},
  ) {
    super();
    this.type = options.type ?? "position";
    this.axis = options.axis ?? "x";
    this.magnitude = options.magnitude ?? 50;
    this.period = options.period ?? 2;
  }

  override onAttach(): void {
    this._elapsed = 0;
  }

  update(ctx: BehaviorContext): void {
    const transform = ctx.entity.getComponent<Transform>("Transform");
    if (transform === undefined) return;

    // Capture origins on first frame
    if (this._elapsed === 0) {
      this._originX = transform.x;
      this._originY = transform.y;
      this._originScaleX = transform.scaleX;
      this._originScaleY = transform.scaleY;
    }

    this._elapsed += ctx.dt;
    const offset =
      this.magnitude * Math.sin((2 * Math.PI * this._elapsed) / this.period);

    if (this.type === "position") {
      if (this.axis === "x") {
        transform.x = this._originX + offset;
      } else {
        transform.y = this._originY + offset;
      }
    } else if (this.type === "scale") {
      const scaleOffset = 1 + offset / this.magnitude;
      if (this.axis === "x") {
        transform.scaleX = this._originScaleX * scaleOffset;
      } else {
        transform.scaleY = this._originScaleY * scaleOffset;
      }
    } else if (this.type === "opacity") {
      const sprite = ctx.entity.getComponent<{ alpha: number }>("Sprite");
      if (sprite !== undefined) {
        sprite.alpha = Math.max(
          0,
          Math.min(1, 0.5 + offset / (this.magnitude * 2)),
        );
      }
    }
  }
}

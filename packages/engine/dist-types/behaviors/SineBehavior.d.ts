import { Behavior, type BehaviorContext } from "./Behavior.js";
export type SineType = "position" | "scale" | "opacity";
export type SineAxis = "x" | "y";
/**
 * SineBehavior — oscillates a Transform property on a sine wave.
 * Saves the entity's origin values at attach time and applies an offset
 * each frame. Opacity requires a component named 'Sprite' with an
 * `alpha` property (standard EmptySock Sprite component).
 */
export declare class SineBehavior extends Behavior {
  type: SineType;
  axis: SineAxis;
  magnitude: number;
  /** Period in seconds (time for one full cycle). */
  period: number;
  private _elapsed;
  private _originX;
  private _originY;
  private _originScaleX;
  private _originScaleY;
  constructor(options?: {
    type?: SineType;
    axis?: SineAxis;
    magnitude?: number;
    period?: number;
  });
  onAttach(): void;
  update(ctx: BehaviorContext): void;
}

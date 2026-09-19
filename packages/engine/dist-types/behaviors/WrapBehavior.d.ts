import { Behavior, type BehaviorContext } from "./Behavior.js";
/**
 * WrapBehavior — wraps an entity's position around the viewport edges.
 * Pass the canvas width and height to the constructor.
 */
export declare class WrapBehavior extends Behavior {
  margin: number;
  private readonly _width;
  private readonly _height;
  constructor(width: number, height: number, margin?: number);
  update(ctx: BehaviorContext): void;
}

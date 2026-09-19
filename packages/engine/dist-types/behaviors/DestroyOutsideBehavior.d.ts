import { Behavior, type BehaviorContext } from "./Behavior.js";
/**
 * DestroyOutsideBehavior — removes the entity from the scene when its
 * Transform position leaves the layout bounds (plus optional margin).
 */
export declare class DestroyOutsideBehavior extends Behavior {
  margin: number;
  private readonly _x;
  private readonly _y;
  private readonly _width;
  private readonly _height;
  constructor(options?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    margin?: number;
  });
  update(ctx: BehaviorContext): void;
}

import { Behavior, type BehaviorContext } from "./Behavior.js";
/**
 * BulletBehavior — moves an entity at a constant angle each frame.
 * When destroyOutside is true and the entity leaves the bounding rect,
 * it is removed from the scene.
 */
export declare class BulletBehavior extends Behavior {
  speed: number;
  /** Angle in radians (0 = right). */
  angle: number;
  destroyOutside: boolean;
  private readonly _boundsX;
  private readonly _boundsY;
  private readonly _boundsWidth;
  private readonly _boundsHeight;
  constructor(options?: {
    speed?: number;
    angle?: number;
    destroyOutside?: boolean;
    boundsX?: number;
    boundsY?: number;
    boundsWidth?: number;
    boundsHeight?: number;
  });
  update(ctx: BehaviorContext): void;
}

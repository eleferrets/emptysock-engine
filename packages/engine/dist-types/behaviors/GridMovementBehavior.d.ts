import { Behavior, type BehaviorContext } from "./Behavior.js";
import type { InputSystem } from "../systems/InputSystem.js";
export interface GridMovementOptions {
  /** Size of one tile in pixels. Default 32. */
  tileSize?: number;
  /** Movement speed in tiles per second. Default 4. */
  speed?: number;
  /** InputSystem instance. */
  input: InputSystem;
  /** Optional collision check: return true if the tile at (tileX, tileY) is solid. */
  isSolid?: (tileX: number, tileY: number) => boolean;
}
/**
 * GridMovementBehavior — 4-directional tile-aligned movement.
 *
 * The entity slides smoothly between tile centres at `speed` tiles/second.
 * Input is only accepted when the entity is not mid-move. `isSolid` is checked
 * before each move starts — return true to block a direction.
 */
export declare class GridMovementBehavior extends Behavior {
  tileSize: number;
  speed: number;
  private readonly _input;
  private readonly _isSolid;
  private _gridX;
  private _gridY;
  private _targetX;
  private _targetY;
  private _moving;
  constructor(opts: GridMovementOptions);
  update(ctx: BehaviorContext): void;
}

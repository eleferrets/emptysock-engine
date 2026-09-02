import { Behavior, type BehaviorContext } from "./Behavior.js";
import type { Transform } from "../components/Transform.js";
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
export class GridMovementBehavior extends Behavior {
  public tileSize: number;
  public speed: number; // tiles per second
  private readonly _input: InputSystem;
  private readonly _isSolid: (tx: number, ty: number) => boolean;

  // Current grid position (updated when move starts)
  private _gridX: number = 0;
  private _gridY: number = 0;
  // Target pixel position
  private _targetX: number = 0;
  private _targetY: number = 0;
  private _moving: boolean = false;

  constructor(opts: GridMovementOptions) {
    super();
    this.tileSize = opts.tileSize ?? 32;
    this.speed = opts.speed ?? 4;
    this._input = opts.input;
    this._isSolid = opts.isSolid ?? (() => false);
  }

  update(ctx: BehaviorContext): void {
    const transform = ctx.entity.getComponent<Transform>("Transform");
    if (transform === undefined) return;

    if (this._moving) {
      // Slide toward target
      const pixelSpeed = this.speed * this.tileSize * ctx.dt;
      const dx = this._targetX - transform.x;
      const dy = this._targetY - transform.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= pixelSpeed) {
        transform.x = this._targetX;
        transform.y = this._targetY;
        this._moving = false;
      } else {
        transform.x += (dx / dist) * pixelSpeed;
        transform.y += (dy / dist) * pixelSpeed;
      }
      return;
    }

    // Read input when idle
    const ts = this.tileSize;
    // snap to grid (handles initial position)
    this._gridX = Math.round(transform.x / ts);
    this._gridY = Math.round(transform.y / ts);

    let nx = this._gridX;
    let ny = this._gridY;

    if (this._input.isKeyDown("ArrowLeft") || this._input.isKeyDown("KeyA"))
      nx -= 1;
    else if (
      this._input.isKeyDown("ArrowRight") ||
      this._input.isKeyDown("KeyD")
    )
      nx += 1;
    else if (this._input.isKeyDown("ArrowUp") || this._input.isKeyDown("KeyW"))
      ny -= 1;
    else if (
      this._input.isKeyDown("ArrowDown") ||
      this._input.isKeyDown("KeyS")
    )
      ny += 1;
    else return;

    if (nx === this._gridX && ny === this._gridY) return;
    if (this._isSolid(nx, ny)) return;

    this._gridX = nx;
    this._gridY = ny;
    this._targetX = nx * ts;
    this._targetY = ny * ts;
    this._moving = true;
  }
}

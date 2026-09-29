import { ColorOverlayFilter } from "pixi-filters";
import type { Scene } from "../Scene.js";
/**
 * Advances every active `SpriteFlash`. Pure component maths, no renderer
 * types: `amount` falls from `peak` to 0 over `duration` seconds and the
 * flash deactivates when done. Called once per frame by `Game.update()`.
 */
export declare class SpriteFlashSystem {
  update(scene: Scene, dt: number): void;
}
/**
 * Pool of `pixi-filters` `ColorOverlayFilter`s (single pass, alpha-preserving,
 * `color` + `alpha` uniforms). A filter is only checked out while a sprite is
 * mid-flash, so idle sprites carry no filter and cost nothing.
 */
export declare class FlashFilterPool {
  private readonly _free;
  private _live;
  acquire(color: number, amount: number): ColorOverlayFilter;
  configure(f: ColorOverlayFilter, color: number, amount: number): void;
  release(f: ColorOverlayFilter): void;
  /** Filters currently checked out. */
  get liveCount(): number;
  /** Filters idle in the pool. */
  get freeCount(): number;
}

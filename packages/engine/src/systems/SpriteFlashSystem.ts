import { ColorOverlayFilter } from "pixi-filters";
import type { Scene } from "../Scene.js";
import { SpriteFlash } from "../components/SpriteFlash.js";
import { ease } from "../easing.js";

/**
 * Advances every active `SpriteFlash`. Pure component maths, no renderer
 * types: `amount` falls from `peak` to 0 over `duration` seconds and the
 * flash deactivates when done. Called once per frame by `Game.update()`.
 */
export class SpriteFlashSystem {
  update(scene: Scene, dt: number): void {
    scene.each(SpriteFlash, (f) => {
      if (!f.active) return;
      f.elapsed += dt;
      const t = f.duration > 0 ? f.elapsed / f.duration : 1;
      if (t >= 1) {
        f.amount = 0;
        f.active = false;
        return;
      }
      f.amount = f.peak * (1 - ease(f.easing, Math.max(0, t)));
    });
  }
}

/**
 * Pool of `pixi-filters` `ColorOverlayFilter`s (single pass, alpha-preserving,
 * `color` + `alpha` uniforms). A filter is only checked out while a sprite is
 * mid-flash, so idle sprites carry no filter and cost nothing.
 */
export class FlashFilterPool {
  private readonly _free: ColorOverlayFilter[] = [];
  private _live = 0;

  acquire(color: number, amount: number): ColorOverlayFilter {
    const f = this._free.pop() ?? new ColorOverlayFilter();
    this._live++;
    this.configure(f, color, amount);
    return f;
  }

  configure(f: ColorOverlayFilter, color: number, amount: number): void {
    if (f.color !== color) f.color = color;
    if (f.alpha !== amount) f.alpha = amount;
  }

  release(f: ColorOverlayFilter): void {
    this._live--;
    this._free.push(f);
  }

  /** Filters currently checked out. */
  get liveCount(): number {
    return this._live;
  }

  /** Filters idle in the pool. */
  get freeCount(): number {
    return this._free.length;
  }
}

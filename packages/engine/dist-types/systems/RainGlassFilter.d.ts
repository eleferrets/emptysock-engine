import { Filter } from "pixi.js";
export interface RainGlassFilterOptions {
  /** 0..1 overall droplet opacity/refraction strength. Default 0.6. */
  intensity?: number;
  /** Aspect-corrected UV-space cell size for the large droplet grid — smaller = more, smaller drops. Default 0.12. */
  dropletSize?: number;
  /** UV-space fall speed per second for the streak grid. Default 0.35. */
  dropletSpeed?: number;
  /** 0..1 blend between static droplets (0) and falling streaks (1). Default 0.5. */
  streakAmount?: number;
}
/**
 * The real pixi Filter for `PostProcessSystem`'s `"rain-glass"` layer
 * filter type — see this file's header comment for the technique and its
 * honest limits. Built and cached exactly like `CustomShaderFilter`: one
 * instance per layer, its uniforms re-applied in place on every
 * `RenderSystem.syncPostProcessLayerFilters()` call rather than being
 * reconstructed, and `tick()` called once per frame to advance `uTime` (the
 * one uniform this shader needs updated continuously for droplets to fall).
 */
export declare class RainGlassFilter extends Filter {
  private _elapsed;
  constructor(options?: RainGlassFilterOptions);
  private get _u();
  private _set;
  setOptions(options: RainGlassFilterOptions): void;
  setResolution(width: number, height: number): void;
  /** Advances `uTime` by `dtSeconds`. Call once per frame. */
  tick(dtSeconds: number): void;
  get elapsed(): number;
}
export declare function createRainGlassFilter(
  options?: RainGlassFilterOptions,
): RainGlassFilter;

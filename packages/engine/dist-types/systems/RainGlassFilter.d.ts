import { Filter } from "pixi.js";
export declare const RAIN_GLASS_FRAGMENT =
  "\n  precision highp float;\n  in vec2 vUV;\n  out vec4 finalColor;\n\n  uniform sampler2D uTexture;\n  uniform float uTime;\n  uniform float uIntensity;\n  uniform float uDropletSize;\n  uniform float uDropletSpeed;\n  uniform float uStreakAmount;\n  uniform vec2 uResolution;\n\n  float hash21(vec2 p) {\n    p = fract(p * vec2(123.34, 456.21));\n    p += dot(p, p + 45.32);\n    return fract(p.x * p.y);\n  }\n\n  // One procedural droplet grid: returns (fakeNormal.xy, dropMask).\n  // cellSize is in aspect-corrected UV units; fallSpeed scrolls the\n  // whole grid downward over time (0 = static droplet, >0 = falling\n  // streak), and seed decorrelates the two grid layers this shader\n  // blends between so they don't visually line up.\n  vec3 dropLayer(vec2 uv, float cellSize, float fallSpeed, float seed) {\n    vec2 aspectUv = uv * uResolution / min(uResolution.x, uResolution.y);\n    aspectUv.y -= uTime * fallSpeed; // features drift toward +y (down the screen)\n\n    vec2 cell = floor(aspectUv / cellSize);\n    vec2 local = fract(aspectUv / cellSize) - 0.5;\n\n    float rnd = hash21(cell + seed);\n    vec2 jitter = vec2(hash21(cell + seed + 7.0), hash21(cell + seed + 13.0)) - 0.5;\n    vec2 centre = jitter * 0.6;\n\n    float radius = mix(0.15, 0.45, rnd);\n    float d = length(local - centre);\n    float drop = smoothstep(radius, radius * 0.4, d);\n\n    vec2 normal = (local - centre) / max(radius, 0.001);\n\n    // Trail: a thin, fading wet streak above a falling drop (only when the\n    // layer actually falls), narrower than the drop and shrinking upward.\n    float trail = 0.0;\n    if (fallSpeed > 0.0) {\n      float above = centre.y - local.y; // >0 above the drop\n      float along = smoothstep(0.0, 0.5, above) * (1.0 - smoothstep(0.5, 0.5 + 0.5 * rnd, above));\n      float width = radius * 0.25 * (1.0 - clamp(above, 0.0, 1.0) * 0.6);\n      trail = along * smoothstep(width, width * 0.3, abs(local.x - centre.x)) * 0.6;\n    }\n    float m = max(drop, trail);\n    return vec3(normal * drop + vec2(0.0, -0.3) * trail, m);\n  }\n\n  void main() {\n    vec2 uv = vUV;\n\n    // Large, near-static droplets (fallSpeed scaled way down) blended\n    // against small, fast-falling streaks \u2014 uStreakAmount picks the mix,\n    // matching PostProcessSystem's RainGlassOptions.streakAmount.\n    vec3 big = dropLayer(uv, uDropletSize, uDropletSpeed * 0.15, 1.0);\n    vec3 small = dropLayer(uv, uDropletSize * 0.4, uDropletSpeed, 42.0);\n\n    vec2 normal = mix(big.xy, small.xy, uStreakAmount);\n    float mask = mix(big.z, small.z, uStreakAmount);\n\n    vec2 refractedUv = uv + normal * mask * 0.06 * uIntensity;\n    vec4 refracted = texture(uTexture, clamp(refractedUv, vec2(0.001), vec2(0.999)));\n    vec4 base = texture(uTexture, uv);\n\n    // A small specular-ish highlight so a drop reads as glass/water, not\n    // just a smudge of distorted pixels.\n    float highlight = pow(clamp(mask, 0.0, 1.0), 3.0) * 0.35;\n\n    finalColor = mix(base, refracted, mask * uIntensity) + vec4(vec3(highlight), 0.0);\n  }\n";
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

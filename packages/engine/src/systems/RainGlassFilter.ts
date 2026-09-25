// "Rain on glass" post-process filter — a GPU-cheap, screen-space
// approximation of streaking water droplets on the camera lens (the visual
// this file exists to replace was the user's own GameMaker/GMS2 shader,
// which "killed the game's performance" there — see RELEASE_PASS.md for the
// full writeup of what made that approach expensive and why this one isn't).
//
// This is built on the exact same mechanism `CustomShaderFilter.ts` already
// established for a user-authored GLSL post-process filter (a pixi.js v8
// `Filter` with a `GlProgram`, a `uTime` uniform updated once per frame) —
// it is not a new filter *mechanism*, just a new *shader* plus a handful of
// extra tunable uniforms, following the "framework-agnostic options type in
// PostProcessSystem, real pixi Filter built in RenderSystem, cached per
// layer" split CLAUDE.md's "PostProcessSystem's layer filters become real
// pixi Filters" entry documents for every other layer-filter type.
//
// ── The technique, and its honest limits ───────────────────────────────────
// This is a single fragment-shader pass, O(screen pixels), with no particle
// system, no per-drop simulation, and no physically-based refraction. Each
// screen pixel is assigned to a procedural "cell" (two overlapping grids —
// one of large, slow droplets, one of small, fast-falling streaks) via a
// cheap hash function; inside a cell, the pixel's offset from the drop's
// (jittered) centre gives a fake radial "normal" that's used to offset the
// texture lookup into the already-rendered scene — the standard cheap
// "refraction" trick real-time screen-space rain/water effects use (the
// same idea as a `DisplacementFilter`, but computed procedurally in-shader
// instead of sampled from a displacement-map texture, so there is no extra
// texture upload or droplet-position CPU bookkeeping per frame at all).
// This is genuinely 2D and screen-space: there is no lens geometry, no
// light bending through an actual water volume, and no accumulation of
// drops merging/sliding into each other over time the way real running
// water does. It is a convincing approximation for "it's raining and the
// screen is wet", not a physical simulation — exactly the tradeoff a real
// Asphalt-8-style effect needs, and exactly the class of naive-per-pixel
// GMS2 shader this replaces (see RELEASE_PASS.md) got wrong by trying to
// do too much per pixel without any of the cheap hashing/cell tricks here.
//
// Cost, concretely: one texture sample for `base`, one more for the
// refracted lookup, a handful of `hash21`/`smoothstep` ALU ops per pixel —
// no loops, no branching on droplet count, no per-drop uniform arrays. This
// scales with screen resolution only, never with "how many raindrops are
// currently on screen" the way a GMS2 shader driving a real per-drop loop
// (or CPU-side per-drop sprite batch feeding a shader every frame) does.
// `RainGlassFilter` never allocates a droplet list, on the GPU or the CPU.

import { Filter, GlProgram } from "pixi.js";

const RAIN_GLASS_VERTEX = /* glsl */ `
  in vec2 aPosition;
  in vec2 aUV;
  out vec2 vUV;
  uniform mat3 uProjectionMatrix;
  uniform mat3 uWorldTransformMatrix;
  uniform mat3 uTransformMatrix;

  void main() {
    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
    vUV = aUV;
  }
`;

const RAIN_GLASS_FRAGMENT = /* glsl */ `
  precision mediump float;
  in vec2 vUV;
  out vec4 finalColor;

  uniform sampler2D uTexture;
  uniform float uTime;
  uniform float uIntensity;
  uniform float uDropletSize;
  uniform float uDropletSpeed;
  uniform float uStreakAmount;
  uniform vec2 uResolution;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  // One procedural droplet grid: returns (fakeNormal.xy, dropMask).
  // cellSize is in aspect-corrected UV units; fallSpeed scrolls the
  // whole grid downward over time (0 = static droplet, >0 = falling
  // streak), and seed decorrelates the two grid layers this shader
  // blends between so they don't visually line up.
  vec3 dropLayer(vec2 uv, float cellSize, float fallSpeed, float seed) {
    vec2 aspectUv = uv * uResolution / min(uResolution.x, uResolution.y);
    aspectUv.y += uTime * fallSpeed;

    vec2 cell = floor(aspectUv / cellSize);
    vec2 local = fract(aspectUv / cellSize) - 0.5;

    float rnd = hash21(cell + seed);
    vec2 jitter = vec2(hash21(cell + seed + 7.0), hash21(cell + seed + 13.0)) - 0.5;
    vec2 centre = jitter * 0.6;

    float radius = mix(0.15, 0.45, rnd);
    float d = length(local - centre);
    float drop = smoothstep(radius, radius * 0.4, d);

    vec2 normal = (local - centre) / max(radius, 0.001);
    return vec3(normal * drop, drop);
  }

  void main() {
    vec2 uv = vUV;

    // Large, near-static droplets (fallSpeed scaled way down) blended
    // against small, fast-falling streaks — uStreakAmount picks the mix,
    // matching PostProcessSystem's RainGlassOptions.streakAmount.
    vec3 big = dropLayer(uv, uDropletSize, uDropletSpeed * 0.15, 1.0);
    vec3 small = dropLayer(uv, uDropletSize * 0.4, uDropletSpeed, 42.0);

    vec2 normal = mix(big.xy, small.xy, uStreakAmount);
    float mask = mix(big.z, small.z, uStreakAmount);

    vec2 refractedUv = uv + normal * mask * 0.06 * uIntensity;
    vec4 refracted = texture(uTexture, clamp(refractedUv, vec2(0.001), vec2(0.999)));
    vec4 base = texture(uTexture, uv);

    // A small specular-ish highlight so a drop reads as glass/water, not
    // just a smudge of distorted pixels.
    float highlight = pow(clamp(mask, 0.0, 1.0), 3.0) * 0.35;

    finalColor = mix(base, refracted, mask * uIntensity) + vec4(vec3(highlight), 0.0);
  }
`;

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
export class RainGlassFilter extends Filter {
  private _elapsed = 0;

  constructor(options: RainGlassFilterOptions = {}) {
    const program = GlProgram.from({
      vertex: RAIN_GLASS_VERTEX,
      fragment: RAIN_GLASS_FRAGMENT,
      name: "emptysock-rain-glass",
    });
    super({ glProgram: program, resources: {} });
    this.resources["uniforms"] = {
      uTime: { value: 0, type: "f32" },
      uIntensity: { value: options.intensity ?? 0.6, type: "f32" },
      uDropletSize: { value: options.dropletSize ?? 0.12, type: "f32" },
      uDropletSpeed: { value: options.dropletSpeed ?? 0.35, type: "f32" },
      uStreakAmount: { value: options.streakAmount ?? 0.5, type: "f32" },
      uResolution: { value: [1, 1], type: "vec2<f32>" },
    };
  }

  private get _u(): Record<string, { value: unknown }> {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- resources["uniforms"] is always set by the constructor above
    return (
      (this.resources["uniforms"] as Record<string, { value: unknown }>) ?? {}
    );
  }

  private _set(name: string, value: unknown): void {
    const uniform = this._u[name];
    if (uniform) uniform.value = value;
  }

  setOptions(options: RainGlassFilterOptions): void {
    if (options.intensity !== undefined)
      this._set("uIntensity", options.intensity);
    if (options.dropletSize !== undefined)
      this._set("uDropletSize", options.dropletSize);
    if (options.dropletSpeed !== undefined)
      this._set("uDropletSpeed", options.dropletSpeed);
    if (options.streakAmount !== undefined)
      this._set("uStreakAmount", options.streakAmount);
  }

  setResolution(width: number, height: number): void {
    this._set("uResolution", [Math.max(1, width), Math.max(1, height)]);
  }

  /** Advances `uTime` by `dtSeconds`. Call once per frame. */
  tick(dtSeconds: number): void {
    this._elapsed += dtSeconds;
    this._set("uTime", this._elapsed);
  }

  get elapsed(): number {
    return this._elapsed;
  }
}

export function createRainGlassFilter(
  options?: RainGlassFilterOptions,
): RainGlassFilter {
  return new RainGlassFilter(options);
}

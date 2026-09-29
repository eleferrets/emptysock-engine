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

import { Filter, GlProgram, UniformGroup } from "pixi.js";

// Pixi Filter vertex contract (see CustomShaderFilter's DEFAULT_CUSTOM_SHADER_VERTEX):
// a filter quad has only `aPosition`, no `aUV`/projection matrices.
const RAIN_GLASS_VERTEX = /* glsl */ `
  in vec2 aPosition;
  out vec2 vUV;
  uniform vec4 uInputSize;
  uniform vec4 uOutputFrame;
  uniform vec4 uOutputTexture;

  void main() {
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    gl_Position = vec4(position, 0.0, 1.0);
    vUV = aPosition * (uOutputFrame.zw * uInputSize.zw);
  }
`;

export const RAIN_GLASS_FRAGMENT = /* glsl */ `
  precision highp float;
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

  // One procedural droplet layer ("Asphalt-style" windshield drops). Each drop
  // is a small lens: inside it the scene is sampled from the *opposite* side of
  // the drop centre (an inverted, magnified miniature of the scene), ringed by
  // a dark refractive rim, a bright specular glint (upper-left) and a faint
  // lower-right caustic crescent. cellSize is in aspect-corrected UV units;
  // fallSpeed > 0 makes the layer's drops slide down at a per-column speed and
  // leave a thin wet trail above them. presence = fraction of cells holding a
  // drop. Returns: xy = UV offset to sample the scene at, z = drop coverage,
  // w = trail coverage; rimGlint = (rim darkening, glint + caustic).
  vec4 dropLayer(vec2 uv, float cellSize, float fallSpeed, float seed, float presence, float stretch, out vec2 rimGlint) {
    float minRes = min(uResolution.x, uResolution.y);
    vec2 aspectUv = uv * uResolution / minRes;
    float colRnd = hash21(vec2(floor(aspectUv.x / cellSize), seed + 3.0));
    aspectUv.y -= uTime * fallSpeed * (0.6 + 0.8 * colRnd);

    // stretch > 1 makes cells taller than wide, leaving room for a long trail.
    vec2 cs = vec2(cellSize, cellSize * stretch);
    vec2 cell = floor(aspectUv / cs);
    vec2 cellPos = fract(aspectUv / cs) - 0.5;
    vec2 local = vec2(cellPos.x, cellPos.y * stretch); // real (round) units, y grows downward

    float rnd = hash21(cell + seed);
    float has = step(hash21(cell + seed + 29.0), presence);
    vec2 jit = vec2(hash21(cell + seed + 7.0), hash21(cell + seed + 13.0)) - 0.5;
    // Tall cells keep the drop in the lower part so the trail above fits.
    vec2 centre = vec2(jit.x * 0.4, jit.y * 0.4 + (stretch - 1.0) * 0.28);
    float radius = mix(0.14, 0.34, rnd);

    vec2 p = local - centre;
    // Slightly taller than wide, heavier at the bottom: a sliding drop.
    float d = length(vec2(p.x, p.y * (p.y > 0.0 ? 0.78 : 0.95)));
    float mask = smoothstep(radius, radius * 0.86, d) * has;

    // Lens: sample from the reflected position across the drop centre.
    vec2 toUv = vec2(minRes) / uResolution;
    vec2 offset = -p * cellSize * 1.7 * toUv;

    float e = clamp(d / radius, 0.0, 1.0);
    float rim = smoothstep(0.62, 1.0, e) * mask;
    vec2 g = p + vec2(0.35, 0.35) * radius; // glint sits up-left of centre
    float glint = smoothstep(radius * 0.3, 0.0, length(g)) * mask;
    float caustic = smoothstep(0.72, 1.0, e) * max(dot(normalize(p + 1e-4), vec2(0.6, 0.8)), 0.0) * mask * 0.35;

    // Wet trail: a thin streak above the drop, narrowing and fading upward.
    float trail = 0.0;
    if (fallSpeed > 0.0) {
      float above = -p.y; // > 0 above the drop centre
      float len = stretch * (0.35 + 0.4 * rnd);
      float along = smoothstep(0.0, 0.1, above) * (1.0 - smoothstep(len * 0.2, len, above));
      float width = radius * 0.32 * (1.0 - clamp(above / len, 0.0, 1.0) * 0.7);
      trail = along * smoothstep(width, width * 0.3, abs(p.x)) * has;
    }

    rimGlint = vec2(rim, glint + caustic);
    return vec4(mix(vec2(0.0), offset, step(0.0001, mask)) + vec2(0.0, -0.004) * trail, mask, trail);
  }

  vec3 applyLayer(vec3 colour, vec2 uv, vec4 layer, vec2 rimGlint, float trailWeight) {
    float k = uIntensity;
    // Trail: faint refractive smear + slight brightening of the wet path.
    if (layer.w > 0.001) {
      vec3 trailCol = texture(uTexture, clamp(uv + vec2(0.0, -0.006), vec2(0.001), vec2(0.999))).rgb;
      colour = mix(colour, trailCol * 1.25 + vec3(0.09), layer.w * 0.85 * trailWeight * clamp(k * 1.3, 0.0, 1.0));
    }
    if (layer.z > 0.001) {
      vec3 inside = texture(uTexture, clamp(uv + layer.xy, vec2(0.001), vec2(0.999))).rgb;
      inside *= 1.0 - 0.45 * rimGlint.x;          // dark refractive rim
      inside += vec3(rimGlint.y * 0.55);          // specular glint + caustic
      colour = mix(colour, inside, layer.z * clamp(k * 1.4, 0.0, 1.0));
    }
    return colour;
  }

  void main() {
    vec2 uv = vUV;
    float streak = clamp(uStreakAmount, 0.0, 1.0);
    vec3 colour = texture(uTexture, uv).rgb;
    float alpha = texture(uTexture, uv).a;

    vec2 rg0; vec2 rg1; vec2 rg2;
    // Micro droplets: tiny, static, dense; weaker refraction.
    vec4 micro = dropLayer(uv, uDropletSize * 0.28, 0.0, 91.0, 0.7, 1.0, rg0);
    micro.xy *= 0.5;
    // Big drops: mostly static, occasionally creeping.
    vec4 big = dropLayer(uv, uDropletSize, uDropletSpeed * 0.1, 1.0, mix(0.7, 0.4, streak), 1.0, rg1);
    // Sliding drops with trails.
    vec4 slide = dropLayer(uv, uDropletSize * 0.55, uDropletSpeed, 42.0, mix(0.15, 0.7, streak), 2.6, rg2);

    colour = applyLayer(colour, uv, micro, rg0, 0.0);
    colour = applyLayer(colour, uv, big, rg1, 0.0);
    colour = applyLayer(colour, uv, slide, rg2, 1.0);

    finalColor = vec4(colour, alpha);
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
    // Must be handed to the Filter constructor so pixi wraps it in a real
    // UniformGroup (a plain object assigned to `resources` afterwards is
    // never uploaded to the GPU).
    const group = new UniformGroup({
      uTime: { value: 0, type: "f32" },
      uIntensity: { value: options.intensity ?? 0.6, type: "f32" },
      uDropletSize: { value: options.dropletSize ?? 0.12, type: "f32" },
      uDropletSpeed: { value: options.dropletSpeed ?? 0.35, type: "f32" },
      uStreakAmount: { value: options.streakAmount ?? 0.5, type: "f32" },
      uResolution: { value: [1, 1], type: "vec2<f32>" },
    });
    super({ glProgram: program, resources: { uniforms: group } });
    this._group = group;
  }

  private readonly _group: UniformGroup;

  private _set(name: string, value: unknown): void {
    if (name in this._group.uniforms) this._group.uniforms[name] = value;
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

// Windshield rain post-process filter.
//
// A CPU simulation (RainGlassSim: pooled drops that spawn, slide, shed
// trails, merge and get cleared by a wiper) is rasterised into a small RGBA8
// "drop map" (RainGlassMap) every frame or two, uploaded through a pixi
// BufferImageSource, and a single fragment pass turns it into refraction
// through the drops, fog blur where the glass is dry, and a specular glint.
// Sim and rasteriser are pure modules with no pixi import; this file is the
// only pixi-aware part.
//
// It carries both a GlProgram and a GpuProgram (a hand-ported WGSL fragment,
// see RainGlassWgsl.ts), so it renders under pixi's WebGL and WebGPU
// renderers. The GLSL path is unchanged; the WGSL path is UNVERIFIED on a
// real GPU (only naga-validated headlessly). The texture binding follows pixi's own
// DisplacementFilter pattern (`resources: { uniforms, uDropMap: source,
// uDropMapSampler: source.style }`). That binding, the map's vertical
// orientation against vUV, and all timing are UNVERIFIED on a real GPU:
// headless tests only cover the sim, the map and option plumbing.

import {
  BufferImageSource,
  Filter,
  GlProgram,
  GpuProgram,
  UniformGroup,
} from "pixi.js";
import type { GPUTier } from "../GPUTier.js";
import {
  RAIN_GLASS_WGSL_FRAGMENT,
  RAIN_GLASS_WGSL_VERTEX,
} from "./RainGlassWgsl.js";
import { rasterizeRainDropMap } from "./RainGlassMap.js";
import { RainGlassSim, type WiperOptions } from "./RainGlassSim.js";
import {
  rainMapSize,
  resolveRainQuality,
  type RainQuality,
  type RainTier,
} from "./RainGlassTiers.js";

export type { RainQuality, WiperOptions };

// Pixi Filter vertex contract (see CustomShaderFilter's DEFAULT_CUSTOM_SHADER_VERTEX):
// a filter quad has only `aPosition`, no `aUV`/projection matrices.
const RAIN_GLASS_VERTEX = /* glsl */ `#version 300 es
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

export const RAIN_GLASS_FRAGMENT = /* glsl */ `#version 300 es
  precision highp float;
  in vec2 vUV;
  out vec4 finalColor;

  uniform sampler2D uTexture;
  uniform sampler2D uDropMap;
  uniform float uFog;
  uniform float uBlur;
  uniform float uRefract;
  uniform float uTaps;
  uniform float uChroma;
  uniform vec3 uTint;
  uniform vec2 uLightDir;
  uniform vec2 uResolution;

  #define MAX_TAPS 8

  float ign(vec2 p) {
    return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
  }

  // Golden-angle disc blur, rotated per pixel; uTaps <= MAX_TAPS.
  vec3 fogBlur(vec2 uv, float px, vec2 texel) {
    vec3 acc = vec3(0.0);
    float n = 6.2831853 * ign(gl_FragCoord.xy);
    int taps = int(uTaps);
    for (int i = 0; i < MAX_TAPS; i++) {
      if (i >= taps) break;
      float a = float(i) * 2.39996 + n;
      float r = sqrt((float(i) + 0.5) / float(taps)) * px;
      acc += textureLod(uTexture, uv + vec2(cos(a), sin(a)) * r * texel, 0.0).rgb;
    }
    return acc / float(max(taps, 1));
  }

  void main() {
    vec4 m = texture(uDropMap, vUV);
    vec2 n = (m.rg * 255.0 - 128.0) / 127.0;
    float h = m.b;
    float wet = m.a;
    vec2 off = n * uRefract * h;
    vec2 uv = clamp(vUV - off, 0.0, 1.0);
    vec4 base = textureLod(uTexture, uv, 0.0);
    vec3 col = base.rgb;
    if (uChroma > 0.5) {
      col.r = textureLod(uTexture, clamp(uv + off * 0.25, 0.0, 1.0), 0.0).r;
      col.b = textureLod(uTexture, clamp(uv - off * 0.25, 0.0, 1.0), 0.0).b;
    }
    float fogHere = uFog * (1.0 - wet);
    if (fogHere > 0.001 && uTaps > 0.5) {
      vec3 b = fogBlur(uv, uBlur * fogHere, 1.0 / uResolution);
      col = mix(col, b, smoothstep(0.0, 0.2, fogHere));
    }
    col = mix(col, uTint, fogHere * 0.25);
    float spec = pow(max(dot(normalize(vec3(n, 0.6)), normalize(vec3(uLightDir, 0.7))), 0.0), 24.0);
    col += spec * h * 0.6;
    col *= 1.0 - 0.25 * smoothstep(0.7, 1.0, length(n)) * h;
    finalColor = vec4(col, base.a);
  }
`;

export interface RainGlassFilterOptions {
  /** 0..1 spawn rate and refraction strength. Default 0.6. */
  intensity?: number;
  /** Droplet size; 0.12 is the default size, scales radii proportionally. */
  dropletSize?: number;
  /** Slide speed scale; 0.35 is the default speed. */
  dropletSpeed?: number;
  /** Trail amount scale; 0.5 is the default, 0 disables trails. */
  streakAmount?: number;
  /** Quality tier; "auto" (default) uses the host GPU tier. */
  quality?: RainQuality;
  /** 0..1 condensation. Default 0. */
  fog?: number;
  /** Max fog blur radius in scene px. Default 6. */
  blur?: number;
  /** 0..1 gravity scale (0 flat, 1 vertical glass). Default 1. */
  slope?: number;
  /** Lateral wind in map px/s. Default 0. */
  wind?: number;
  /** Sim RNG seed. Default 1. */
  seed?: number;
  wiper?: Partial<WiperOptions>;
  /** Fog tint rgb 0..1. */
  tint?: [number, number, number];
}

const DEFAULT_DROPLET_SIZE = 0.12;
const DEFAULT_DROPLET_SPEED = 0.35;
const DEFAULT_STREAK = 0.5;

export class RainGlassFilter extends Filter {
  private _elapsed = 0;
  private _frame = 0;
  private _rainDestroyed = false;
  private readonly _group: UniformGroup;
  private readonly _source: BufferImageSource;
  private _buffer: Uint8Array;
  private _sim: RainGlassSim;
  private _tier: RainTier;
  private readonly _gpuTier: GPUTier | undefined;
  private _quality: RainQuality;
  private _seed: number;
  private _mapW: number;
  private _mapH: number;
  private _aspect = 16 / 9;
  private _wiperPatch: Partial<WiperOptions> = {};
  private readonly _o = {
    intensity: 0.6,
    dropletSize: DEFAULT_DROPLET_SIZE,
    dropletSpeed: DEFAULT_DROPLET_SPEED,
    streakAmount: DEFAULT_STREAK,
    fog: 0,
    blur: 6,
    slope: 1,
    wind: 0,
  };

  constructor(options: RainGlassFilterOptions = {}, gpuTier?: GPUTier) {
    const tier = resolveRainQuality(options.quality, gpuTier);
    const size = rainMapSize(tier, 16 / 9);
    const buffer = new Uint8Array(size.width * size.height * 4);
    // rgba8unorm must be explicit: pixi picks bgra8unorm for a Uint8Array.
    const source = new BufferImageSource({
      resource: buffer,
      width: size.width,
      height: size.height,
      format: "rgba8unorm",
      scaleMode: "linear",
    });
    const tint = options.tint ?? [0.8, 0.85, 0.9];
    const group = new UniformGroup({
      uTime: { value: 0, type: "f32" },
      uIntensity: { value: options.intensity ?? 0.6, type: "f32" },
      uDropletSize: {
        value: options.dropletSize ?? DEFAULT_DROPLET_SIZE,
        type: "f32",
      },
      uDropletSpeed: {
        value: options.dropletSpeed ?? DEFAULT_DROPLET_SPEED,
        type: "f32",
      },
      uStreakAmount: {
        value: options.streakAmount ?? DEFAULT_STREAK,
        type: "f32",
      },
      uResolution: { value: [1, 1], type: "vec2<f32>" },
      uFog: { value: options.fog ?? 0, type: "f32" },
      uBlur: { value: options.blur ?? 6, type: "f32" },
      uRefract: { value: 0.1, type: "f32" },
      uTaps: { value: tier.blurTaps, type: "f32" },
      uChroma: { value: tier.chromatic ? 1 : 0, type: "f32" },
      uTint: { value: [tint[0], tint[1], tint[2]], type: "vec3<f32>" },
      uLightDir: { value: [-0.5, -0.6], type: "vec2<f32>" },
    });
    super({
      glProgram: GlProgram.from({
        vertex: RAIN_GLASS_VERTEX,
        fragment: RAIN_GLASS_FRAGMENT,
        name: "emptysock-rain-glass",
      }),
      gpuProgram: GpuProgram.from({
        name: "emptysock-rain-glass",
        vertex: { source: RAIN_GLASS_WGSL_VERTEX, entryPoint: "mainVertex" },
        fragment: {
          source: RAIN_GLASS_WGSL_FRAGMENT,
          entryPoint: "mainFragment",
        },
      }),
      resources: {
        uniforms: group,
        uDropMap: source,
        uDropMapSampler: source.style,
      },
    });
    this._group = group;
    this._source = source;
    this._buffer = buffer;
    this._tier = tier;
    this._gpuTier = gpuTier;
    this._quality = options.quality ?? "auto";
    this._seed = options.seed ?? 1;
    this._mapW = size.width;
    this._mapH = size.height;
    if (options.intensity !== undefined) this._o.intensity = options.intensity;
    if (options.dropletSize !== undefined)
      this._o.dropletSize = options.dropletSize;
    if (options.dropletSpeed !== undefined)
      this._o.dropletSpeed = options.dropletSpeed;
    if (options.streakAmount !== undefined)
      this._o.streakAmount = options.streakAmount;
    if (options.fog !== undefined) this._o.fog = options.fog;
    if (options.blur !== undefined) this._o.blur = options.blur;
    if (options.slope !== undefined) this._o.slope = options.slope;
    if (options.wind !== undefined) this._o.wind = options.wind;
    if (options.wiper) this._wiperPatch = { ...options.wiper };
    this._sim = this._buildSim();
    this._syncUniforms();
  }

  private _set(name: string, value: unknown): void {
    if (name in this._group.uniforms) this._group.uniforms[name] = value;
  }

  private _buildSim(): RainGlassSim {
    const t = this._tier;
    const o = this._o;
    return new RainGlassSim({
      width: this._mapW,
      height: this._mapH,
      maxDrops: t.maxDrops,
      spawnPerSec: t.spawnPerSec,
      seed: this._seed,
      intensity: o.intensity,
      sizeScale: o.dropletSize / DEFAULT_DROPLET_SIZE,
      stepSec: 1 / t.simHz,
      slope: o.slope,
      wind: o.wind,
      speedScale: o.dropletSpeed / DEFAULT_DROPLET_SPEED,
      trailScale: o.streakAmount / DEFAULT_STREAK,
      beadCap: t.beadCap,
      trails: t.trails,
      fog: o.fog,
      wiper: this._wiperPatch,
    });
  }

  /** Pushes tier and live option values into the sim and uniforms. */
  private _syncUniforms(): void {
    const o = this._o;
    const s = this._sim;
    s.intensity = o.intensity;
    s.sizeScale = o.dropletSize / DEFAULT_DROPLET_SIZE;
    s.speedScale = o.dropletSpeed / DEFAULT_DROPLET_SPEED;
    s.trailScale = o.streakAmount / DEFAULT_STREAK;
    s.slope = o.slope;
    s.wind = o.wind;
    s.fogTarget = o.fog;
    this._set("uIntensity", o.intensity);
    this._set("uDropletSize", o.dropletSize);
    this._set("uDropletSpeed", o.dropletSpeed);
    this._set("uStreakAmount", o.streakAmount);
    this._set("uBlur", o.blur);
    this._set("uFog", s.fog);
    this._set("uTaps", this._tier.blurTaps);
    this._set("uChroma", this._tier.chromatic ? 1 : 0);
  }

  /** Rebuilds the sim (drops reset) and resizes the map when tier, aspect or seed changed. */
  private _rebuild(): void {
    const size = rainMapSize(this._tier, this._aspect);
    if (size.width !== this._mapW || size.height !== this._mapH) {
      this._mapW = size.width;
      this._mapH = size.height;
      this._buffer = new Uint8Array(size.width * size.height * 4);
      this._source.resource = this._buffer;
      this._source.resize(size.width, size.height);
    }
    this._sim = this._buildSim();
    this._syncUniforms();
  }

  setOptions(options: RainGlassFilterOptions): void {
    const o = this._o;
    if (options.intensity !== undefined) o.intensity = options.intensity;
    if (options.dropletSize !== undefined) o.dropletSize = options.dropletSize;
    if (options.dropletSpeed !== undefined)
      o.dropletSpeed = options.dropletSpeed;
    if (options.streakAmount !== undefined)
      o.streakAmount = options.streakAmount;
    if (options.fog !== undefined) o.fog = options.fog;
    if (options.blur !== undefined) o.blur = options.blur;
    if (options.slope !== undefined) o.slope = options.slope;
    if (options.wind !== undefined) o.wind = options.wind;
    if (options.tint !== undefined)
      this._set("uTint", [options.tint[0], options.tint[1], options.tint[2]]);
    let rebuild = false;
    if (options.quality !== undefined && options.quality !== this._quality) {
      this._quality = options.quality;
      this._tier = resolveRainQuality(options.quality, this._gpuTier);
      rebuild = true;
    }
    if (options.seed !== undefined && options.seed !== this._seed) {
      this._seed = options.seed;
      rebuild = true;
    }
    if (options.wiper !== undefined) {
      Object.assign(this._wiperPatch, options.wiper);
      this._sim.setWiper(options.wiper);
    }
    if (rebuild) this._rebuild();
    else this._syncUniforms();
  }

  setResolution(width: number, height: number): void {
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    this._set("uResolution", [w, h]);
    const aspect = w / h;
    const size = rainMapSize(this._tier, aspect);
    this._aspect = aspect;
    if (size.width !== this._mapW || size.height !== this._mapH)
      this._rebuild();
  }

  /** Advances the sim by `dtSeconds * timeScale`, uploads the map, and updates `uTime`. */
  tick(dtSeconds: number, timeScale = 1): void {
    const dt = Math.max(0, dtSeconds) * timeScale;
    this._elapsed += dt;
    this._set("uTime", this._elapsed);
    this._sim.step(dt);
    if (this._frame++ % this._tier.uploadEvery === 0) {
      rasterizeRainDropMap(this._sim, this._buffer);
      this._source.update();
    }
    this._set("uFog", this._sim.fog);
  }

  /** One-shot wiper sweep. */
  triggerWipe(): void {
    this._sim.triggerWipe();
  }

  /** Blade angle in radians for a game-drawn wiper. */
  get wiperAngle(): number {
    return this._sim.wiperAngle;
  }

  get dropCount(): number {
    return this._sim.dropCount;
  }

  get elapsed(): number {
    return this._elapsed;
  }

  get sim(): RainGlassSim {
    return this._sim;
  }

  get tier(): RainTier {
    return this._tier;
  }

  get dropMap(): Uint8Array {
    return this._buffer;
  }

  override destroy(destroyProgram = false): void {
    if (this._rainDestroyed) return;
    this._rainDestroyed = true;
    super.destroy(destroyProgram);
    this._source.destroy();
  }
}

export function createRainGlassFilter(
  options?: RainGlassFilterOptions,
  gpuTier?: GPUTier,
): RainGlassFilter {
  return new RainGlassFilter(options, gpuTier);
}

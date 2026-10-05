import { Filter } from "pixi.js";
import type { GPUTier } from "../GPUTier.js";
import { RainGlassSim, type WiperOptions } from "./RainGlassSim.js";
import { type RainQuality, type RainTier } from "./RainGlassTiers.js";
export type { RainQuality, WiperOptions };
export declare const RAIN_GLASS_FRAGMENT =
  "#version 300 es\n  precision highp float;\n  in vec2 vUV;\n  out vec4 finalColor;\n\n  uniform sampler2D uTexture;\n  uniform sampler2D uDropMap;\n  uniform float uFog;\n  uniform float uBlur;\n  uniform float uRefract;\n  uniform float uTaps;\n  uniform float uChroma;\n  uniform vec3 uTint;\n  uniform vec2 uLightDir;\n  uniform vec2 uResolution;\n\n  #define MAX_TAPS 8\n\n  float ign(vec2 p) {\n    return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));\n  }\n\n  // Golden-angle disc blur, rotated per pixel; uTaps <= MAX_TAPS.\n  vec3 fogBlur(vec2 uv, float px, vec2 texel) {\n    vec3 acc = vec3(0.0);\n    float n = 6.2831853 * ign(gl_FragCoord.xy);\n    int taps = int(uTaps);\n    for (int i = 0; i < MAX_TAPS; i++) {\n      if (i >= taps) break;\n      float a = float(i) * 2.39996 + n;\n      float r = sqrt((float(i) + 0.5) / float(taps)) * px;\n      acc += textureLod(uTexture, uv + vec2(cos(a), sin(a)) * r * texel, 0.0).rgb;\n    }\n    return acc / float(max(taps, 1));\n  }\n\n  void main() {\n    vec4 m = texture(uDropMap, vUV);\n    vec2 n = (m.rg * 255.0 - 128.0) / 127.0;\n    float h = m.b;\n    float wet = m.a;\n    float body = smoothstep(0.2, 0.5, h);\n    float film = smoothstep(0.02, 0.2, h) * (1.0 - body);\n    float rim = smoothstep(0.3, 0.9, length(n)) * body;\n    vec2 off = n * uRefract * (0.25 + body) + n * film * uRefract * 0.5;\n    vec2 uv = clamp(vUV - off, 0.0, 1.0);\n    vec4 base = textureLod(uTexture, uv, 0.0);\n    vec3 col = base.rgb;\n    if (uChroma > 0.5) {\n      col.r = textureLod(uTexture, clamp(uv + off * 0.25, 0.0, 1.0), 0.0).r;\n      col.b = textureLod(uTexture, clamp(uv - off * 0.25, 0.0, 1.0), 0.0).b;\n    }\n    float fogHere = uFog * (1.0 - wet);\n    if (fogHere > 0.001 && uTaps > 0.5) {\n      vec3 b = fogBlur(uv, uBlur * fogHere, 1.0 / uResolution);\n      col = mix(col, b, smoothstep(0.0, 0.2, fogHere));\n    }\n    col = mix(col, uTint, fogHere * 0.25);\n    vec3 nn = normalize(vec3(n, 0.6));\n    float spec = pow(max(dot(nn, normalize(vec3(uLightDir, 0.7))), 0.0), 20.0);\n    float glint = pow(max(dot(nn, normalize(vec3(-uLightDir, 0.5))), 0.0), 40.0);\n    col *= 1.0 - 0.5 * rim - 0.08 * film;\n    col += (spec * 1.1 + glint * 0.35) * body + rim * 0.10 * uTint + body * 0.025 * uTint;\n    finalColor = vec4(col, base.a);\n  }\n";
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
export declare class RainGlassFilter extends Filter {
  private _elapsed;
  private _frame;
  private _rainDestroyed;
  private readonly _group;
  private readonly _source;
  private _buffer;
  private _sim;
  private _tier;
  private readonly _gpuTier;
  private _quality;
  private _seed;
  private _mapW;
  private _mapH;
  private _aspect;
  private _wiperPatch;
  private readonly _o;
  constructor(options?: RainGlassFilterOptions, gpuTier?: GPUTier);
  private _set;
  private _buildSim;
  /** Pushes tier and live option values into the sim and uniforms. */
  private _syncUniforms;
  /** Rebuilds the sim (drops reset) and resizes the map when tier, aspect or seed changed. */
  private _rebuild;
  setOptions(options: RainGlassFilterOptions): void;
  setResolution(width: number, height: number): void;
  /** Advances the sim by `dtSeconds * timeScale`, uploads the map, and updates `uTime`. */
  tick(dtSeconds: number, timeScale?: number): void;
  /** One-shot wiper sweep. */
  triggerWipe(): void;
  /** Blade angle in radians for a game-drawn wiper. */
  get wiperAngle(): number;
  get dropCount(): number;
  get elapsed(): number;
  get sim(): RainGlassSim;
  get tier(): RainTier;
  get dropMap(): Uint8Array;
  destroy(destroyProgram?: boolean): void;
}
export declare function createRainGlassFilter(
  options?: RainGlassFilterOptions,
  gpuTier?: GPUTier,
): RainGlassFilter;

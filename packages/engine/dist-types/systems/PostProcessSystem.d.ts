import type { TransitionEffect } from "../core/SceneManager.js";
export type LayerFilterType =
  | "blur"
  | "colour-grade"
  | "outline"
  | "brightness"
  | "contrast"
  | "saturate"
  | "hue-rotate"
  | "invert"
  | "none";
export interface LayerFilterOptions {
  type: LayerFilterType;
  /** blur: radius in px */
  radius?: number;
  /** colour-grade, brightness, contrast, saturate: 0..2 (1 = identity) */
  value?: number;
  /** colour-grade: independent saturation override (0..2, 1 = identity) */
  saturation?: number;
  /** colour-grade: independent contrast override (0..2, 1 = identity) */
  contrast?: number;
  /** hue-rotate: degrees */
  degrees?: number;
  /** outline: colour 0xRRGGBB */
  colour?: number;
  /** outline: thickness px */
  thickness?: number;
  enabled?: boolean;
}
export interface LayerFilter {
  layerId: string;
  filter: LayerFilterOptions;
}
export type PostEffectType =
  | "bloom"
  | "chromatic-aberration"
  | "vignette"
  | "scanlines"
  | "pixelate"
  | "colour-grade"
  | "blur"
  | "outline"
  | "shockwave"
  | "noise";
export interface BloomOptions {
  threshold?: number;
  strength?: number;
}
export interface VignetteOptions {
  intensity?: number;
}
export interface BlurOptions {
  strength?: number;
}
export interface PixelateOptions {
  size?: number;
}
export interface ColourGradeOptions {
  lut?: string;
  saturation?: number;
  brightness?: number;
  contrast?: number;
}
export interface ChromaticAberrationOptions {
  offset?: number;
}
export interface ShockwaveOptions {
  x?: number;
  y?: number;
  radius?: number;
  amplitude?: number;
}
export interface OutlineOptions {
  thickness?: number;
  colour?: number;
}
export interface ScanlinesOptions {
  spacing?: number;
}
export interface NoiseOptions {
  intensity?: number;
}
export type PostEffectOptions =
  | BloomOptions
  | VignetteOptions
  | BlurOptions
  | PixelateOptions
  | ColourGradeOptions
  | ChromaticAberrationOptions
  | ShockwaveOptions
  | OutlineOptions
  | ScanlinesOptions
  | NoiseOptions;
export interface ActiveEffect {
  type: PostEffectType;
  options: PostEffectOptions;
  /** Transient effects (flash, shockwave) carry a remaining lifetime in seconds. */
  lifetime?: number;
}
export type { TransitionEffect };
export interface FlashOptions {
  colour?: number;
  duration?: number;
}
export interface FadeOptions {
  to?: number;
  duration?: number;
}
export declare class PostProcessSystem {
  private readonly _persistent;
  private readonly _transients;
  private readonly _layerFilters;
  setLayerFilter(layerId: string, filter: LayerFilterOptions): void;
  clearLayerFilter(layerId: string): void;
  toggleLayerFilter(layerId: string, enabled: boolean): void;
  getLayerFilter(layerId: string): LayerFilterOptions | undefined;
  /** Returns a CSS filter string for a layer, or '' if disabled/not set */
  cssFilterForLayer(layerId: string): string;
  get layerFilters(): ReadonlyMap<string, LayerFilterOptions>;
  transitionEffect: TransitionEffect;
  transitionProgress: number;
  transitionColour: number;
  add(type: PostEffectType, options?: PostEffectOptions): this;
  remove(type: PostEffectType): void;
  has(type: PostEffectType): boolean;
  get(type: PostEffectType): ActiveEffect | undefined;
  get effects(): ReadonlyArray<ActiveEffect>;
  flash(options?: FlashOptions): void;
  private _flashColour;
  private _flashDuration;
  private _flashElapsed;
  get flashActive(): boolean;
  get flashIntensity(): number;
  get flashColour(): number;
  beginTransition(effect: TransitionEffect, colour?: number): void;
  endTransition(): void;
  update(deltaTime: number): void;
  clear(): void;
  destroy(): void;
}

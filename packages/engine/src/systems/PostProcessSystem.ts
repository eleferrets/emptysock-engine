// Post-processing effect registry — framework-agnostic.
// The RenderSystem/PixiJS layer reads this to apply PixiJS filters.

import type { TransitionEffect } from "../core/SceneManager.js";

// ─── Per-layer filter types ───────────────────────────────────────────────────

export type LayerFilterType =
  | "blur"
  | "colour-grade"
  | "outline"
  | "brightness"
  | "contrast"
  | "saturate"
  | "hue-rotate"
  | "invert"
  | "colourblind"
  | "none";

/**
 * Colour-vision-deficiency modes. The matrices shipped here (see
 * `COLOURBLIND_MATRICES`) are the standard Brettel/Viénot/Machado
 * *simulation* matrices — they show a non-colourblind player what a
 * colourblind player sees. They are not a correction/daltonisation filter
 * that increases discriminability for a colourblind player; a full
 * correction algorithm needs per-scene palette analysis and is out of scope
 * for this pass. Ship this honestly as a simulation tool for
 * designers/QA checking their palette, and pair it with palette choices
 * (avoid red/green as the only distinguishing signal) for real accessibility.
 */
export type ColourblindMode = "protanopia" | "deuteranopia" | "tritanopia";

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
  /** colourblind: which deficiency to simulate */
  mode?: ColourblindMode;
  enabled?: boolean;
}

/**
 * Standard colour-vision-deficiency *simulation* matrices (row-major 3x3,
 * applied to linear-ish sRGB). Source: Viénot, Brettel & Mollon /
 * Machado-Oliveira-Fernandes (2009), the commonly cited coefficients used
 * by browser devtools' own CVD emulation. These simulate the deficiency —
 * they do not correct for it.
 */
export const COLOURBLIND_MATRICES: Record<ColourblindMode, readonly number[]> =
  {
    protanopia: [
      0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882,
      -0.048116, 1.051998,
    ],
    deuteranopia: [
      0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182,
      0.04294, 0.968881,
    ],
    tritanopia: [
      1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733,
      0.691367, 0.3039,
    ],
  };

/** Element id used for the injected SVG `<filter>` for a given CVD mode. */
export function colourblindFilterId(mode: ColourblindMode): string {
  return `es-cvd-${mode}`;
}

/**
 * Builds an inert `<svg>` fragment (as markup) containing one `<filter>` per
 * CVD mode via `feColorMatrix`. The host page/renderer injects this once
 * (hidden, zero-size) and references a filter with
 * `cssFilterForLayer()`'s `url(#es-cvd-<mode>)` output. This module never
 * touches the DOM itself — it only returns markup — so it stays inside the
 * engine's environment boundary (no DOM APIs are called here).
 */
export function colourblindFilterDefsSVG(): string {
  const filters = (Object.keys(COLOURBLIND_MATRICES) as ColourblindMode[])
    .map((mode) => {
      const m = COLOURBLIND_MATRICES[mode];
      const values = [
        m[0],
        m[1],
        m[2],
        0,
        0,
        m[3],
        m[4],
        m[5],
        0,
        0,
        m[6],
        m[7],
        m[8],
        0,
        0,
        0,
        0,
        0,
        1,
        0,
      ].join(" ");
      return `<filter id="${colourblindFilterId(mode)}"><feColorMatrix type="matrix" values="${values}"/></filter>`;
    })
    .join("");
  return `<svg width="0" height="0" style="position:absolute"><defs>${filters}</defs></svg>`;
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

export class PostProcessSystem {
  private readonly _persistent: Map<PostEffectType, ActiveEffect> = new Map();
  private readonly _transients: ActiveEffect[] = [];
  private readonly _layerFilters: Map<string, LayerFilterOptions> = new Map();

  // ─── Per-layer filters ────────────────────────────────────────────────────

  setLayerFilter(layerId: string, filter: LayerFilterOptions): void {
    this._layerFilters.set(layerId, { enabled: true, ...filter });
  }

  clearLayerFilter(layerId: string): void {
    this._layerFilters.delete(layerId);
  }

  toggleLayerFilter(layerId: string, enabled: boolean): void {
    const existing = this._layerFilters.get(layerId);
    if (existing) this._layerFilters.set(layerId, { ...existing, enabled });
  }

  getLayerFilter(layerId: string): LayerFilterOptions | undefined {
    return this._layerFilters.get(layerId);
  }

  /** Returns a CSS filter string for a layer, or '' if disabled/not set */
  cssFilterForLayer(layerId: string): string {
    const f = this._layerFilters.get(layerId);
    if (!f || f.enabled === false) return "";
    switch (f.type) {
      case "blur":
        return `blur(${f.radius ?? 4}px)`;
      case "brightness":
        return `brightness(${f.value ?? 1})`;
      case "contrast":
        return `contrast(${f.value ?? 1})`;
      case "saturate":
        return `saturate(${f.value ?? 1})`;
      case "hue-rotate":
        return `hue-rotate(${f.degrees ?? 0}deg)`;
      case "invert":
        return "invert(1)";
      case "colourblind":
        return `url(#${colourblindFilterId(f.mode ?? "deuteranopia")})`;
      case "colour-grade": {
        const sat = f.saturation ?? f.value ?? 1;
        const bri = f.value ?? 1;
        const con = f.contrast ?? 1;
        return `saturate(${sat}) brightness(${bri}) contrast(${con})`;
      }
      case "outline": {
        // CSS approximation using drop-shadow; a proper outline requires a canvas pass
        const col =
          f.colour !== undefined
            ? "#" + (f.colour >>> 0).toString(16).padStart(6, "0")
            : "#000";
        return `drop-shadow(0 0 1px ${col}) drop-shadow(0 0 1px ${col})`;
      }
      default:
        return "";
    }
  }

  get layerFilters(): ReadonlyMap<string, LayerFilterOptions> {
    return this._layerFilters;
  }
  public transitionEffect: TransitionEffect = "none";
  public transitionProgress: number = 0; // 0..1
  public transitionColour: number = 0x000000;

  add(type: PostEffectType, options: PostEffectOptions = {}): this {
    this._persistent.set(type, { type, options });
    return this;
  }

  remove(type: PostEffectType): void {
    this._persistent.delete(type);
  }

  has(type: PostEffectType): boolean {
    return this._persistent.has(type);
  }

  get(type: PostEffectType): ActiveEffect | undefined {
    return this._persistent.get(type);
  }

  get effects(): ReadonlyArray<ActiveEffect> {
    return [...this._persistent.values(), ...this._transients];
  }

  // ─── Transient effects ────────────────────────────────────────────────────

  flash(options: FlashOptions = {}): void {
    const duration = options.duration ?? 0.15;
    const effect: ActiveEffect = {
      type: "bloom",
      options: { strength: 3 },
      lifetime: duration,
    };
    this._transients.push(effect);
    // Replace bloom after flash — store flash colour for the render layer
    this._flashColour = options.colour ?? 0xffffff;
    this._flashDuration = duration;
    this._flashElapsed = 0;
  }

  private _flashColour: number = 0xffffff;
  private _flashDuration: number = 0;
  private _flashElapsed: number = -1;

  get flashActive(): boolean {
    return this._flashElapsed >= 0 && this._flashElapsed < this._flashDuration;
  }
  get flashIntensity(): number {
    if (!this.flashActive) return 0;
    return 1 - this._flashElapsed / this._flashDuration;
  }
  get flashColour(): number {
    return this._flashColour;
  }

  // ─── Scene transition ────────────────────────────────────────────────────

  beginTransition(effect: TransitionEffect, colour: number = 0x000000): void {
    this.transitionEffect = effect;
    this.transitionColour = colour;
    this.transitionProgress = 0;
  }

  endTransition(): void {
    this.transitionEffect = "none";
    this.transitionProgress = 0;
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  update(deltaTime: number): void {
    for (let i = this._transients.length - 1; i >= 0; i--) {
      const e = this._transients[i];
      if (e === undefined) continue;
      if (e.lifetime !== undefined) {
        e.lifetime -= deltaTime;
        if (e.lifetime <= 0) this._transients.splice(i, 1);
      }
    }

    if (this._flashElapsed >= 0) {
      this._flashElapsed += deltaTime;
    }
  }

  clear(): void {
    this._persistent.clear();
    this._transients.length = 0;
    this.transitionEffect = "none";
    this.transitionProgress = 0;
  }

  destroy(): void {
    this.clear();
    this._layerFilters.clear();
    this._flashElapsed = -1;
  }
}

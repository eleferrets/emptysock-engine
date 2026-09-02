// Post-processing effect registry — framework-agnostic.
// The RenderSystem/PixiJS layer reads this to apply PixiJS filters.

// ─── Per-layer filter types ───────────────────────────────────────────────────

export type LayerFilterType = 'blur' | 'colour-grade' | 'outline' | 'brightness' | 'contrast' | 'saturate' | 'hue-rotate' | 'invert' | 'none';

export interface LayerFilterOptions {
  type: LayerFilterType;
  /** blur: radius in px */
  radius?: number;
  /** colour-grade, brightness, contrast, saturate: 0..2 (1 = identity) */
  value?: number;
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
  | 'bloom'
  | 'chromatic-aberration'
  | 'vignette'
  | 'scanlines'
  | 'pixelate'
  | 'colour-grade'
  | 'blur'
  | 'outline'
  | 'shockwave'
  | 'noise';

export interface BloomOptions { threshold?: number; strength?: number; }
export interface VignetteOptions { intensity?: number; }
export interface BlurOptions { strength?: number; }
export interface PixelateOptions { size?: number; }
export interface ColourGradeOptions { lut?: string; saturation?: number; brightness?: number; contrast?: number; }
export interface ChromaticAberrationOptions { offset?: number; }
export interface ShockwaveOptions { x?: number; y?: number; radius?: number; amplitude?: number; }
export interface OutlineOptions { thickness?: number; colour?: number; }
export interface ScanlinesOptions { spacing?: number; }
export interface NoiseOptions { intensity?: number; }

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

export type TransitionEffect = 'fade' | 'wipe' | 'iris' | 'slide' | 'zoom' | 'dissolve' | 'flash' | 'none';

export interface FlashOptions {
  colour?: number;
  duration?: number;
}

export interface FadeOptions {
  to?: number;
  duration?: number;
}

class PostProcessSystemImpl {
  private readonly _effects: ActiveEffect[] = [];
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
    if (!f || f.enabled === false) return '';
    switch (f.type) {
      case 'blur': return `blur(${f.radius ?? 4}px)`;
      case 'brightness': return `brightness(${f.value ?? 1})`;
      case 'contrast': return `contrast(${f.value ?? 1})`;
      case 'saturate': return `saturate(${f.value ?? 1})`;
      case 'hue-rotate': return `hue-rotate(${f.degrees ?? 0}deg)`;
      case 'invert': return 'invert(1)';
      case 'colour-grade': return `saturate(${f.value ?? 1}) brightness(${f.value ?? 1})`;
      case 'outline': return ''; // outline requires a canvas pass
      default: return '';
    }
  }

  get layerFilters(): ReadonlyMap<string, LayerFilterOptions> { return this._layerFilters; }
  public transitionEffect: TransitionEffect = 'none';
  public transitionProgress: number = 0; // 0..1
  public transitionColour: number = 0x000000;

  add(type: PostEffectType, options: PostEffectOptions = {}): this {
    const existing = this._effects.findIndex(e => e.type === type);
    if (existing !== -1) {
      this._effects[existing] = { type, options };
    } else {
      this._effects.push({ type, options });
    }
    return this;
  }

  remove(type: PostEffectType): void {
    const idx = this._effects.findIndex(e => e.type === type);
    if (idx !== -1) this._effects.splice(idx, 1);
  }

  has(type: PostEffectType): boolean {
    return this._effects.some(e => e.type === type);
  }

  get(type: PostEffectType): ActiveEffect | undefined {
    return this._effects.find(e => e.type === type);
  }

  get effects(): ReadonlyArray<ActiveEffect> { return this._effects; }

  // ─── Transient effects ────────────────────────────────────────────────────

  flash(options: FlashOptions = {}): void {
    const duration = options.duration ?? 0.15;
    const effect: ActiveEffect = {
      type: 'bloom',
      options: { strength: 3 },
      lifetime: duration,
    };
    this._effects.push(effect);
    // Replace bloom after flash — store flash colour for the render layer
    this._flashColour = options.colour ?? 0xffffff;
    this._flashDuration = duration;
    this._flashElapsed = 0;
  }

  private _flashColour: number = 0xffffff;
  private _flashDuration: number = 0;
  private _flashElapsed: number = -1;

  get flashActive(): boolean { return this._flashElapsed >= 0 && this._flashElapsed < this._flashDuration; }
  get flashIntensity(): number {
    if (!this.flashActive) return 0;
    return 1 - this._flashElapsed / this._flashDuration;
  }
  get flashColour(): number { return this._flashColour; }

  // ─── Scene transition ────────────────────────────────────────────────────

  beginTransition(effect: TransitionEffect, colour: number = 0x000000): void {
    this.transitionEffect = effect;
    this.transitionColour = colour;
    this.transitionProgress = 0;
  }

  endTransition(): void {
    this.transitionEffect = 'none';
    this.transitionProgress = 0;
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  update(deltaTime: number): void {
    // Decay transient effects
    for (let i = this._effects.length - 1; i >= 0; i--) {
      const e = this._effects[i]!;
      if (e.lifetime !== undefined) {
        e.lifetime -= deltaTime;
        if (e.lifetime <= 0) this._effects.splice(i, 1);
      }
    }

    if (this._flashElapsed >= 0) {
      this._flashElapsed += deltaTime;
    }
  }

  clear(): void {
    this._effects.length = 0;
    this.transitionEffect = 'none';
    this.transitionProgress = 0;
  }
}

export const PostProcessSystem = new PostProcessSystemImpl();

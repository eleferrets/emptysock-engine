// Post-processing effect registry — framework-agnostic.
// The RenderSystem/PixiJS layer reads this to apply PixiJS filters.

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

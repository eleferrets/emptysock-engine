export type EmitterShape = "point" | "circle" | "rectangle" | "line";
/**
 * Renderer-agnostic blend mode, mirroring GameMaker's `part_type_blend`
 * (`pt_blend_normal` / `pt_blend_add`, called via `bm_normal`/`bm_add`
 * equivalents elsewhere in GML). `ParticleEmitter` itself never touches
 * pixi — this is a plain string tag a render layer (`RenderPipeline`'s
 * `mountParticles()`) reads and translates into a real pixi `BLEND_MODES`
 * value on the mounted `ParticleContainer`, the same "engine defines the
 * shape, the render layer applies it" split every other emitter field
 * already follows.
 */
export type ParticleBlendMode = "normal" | "add";
export interface ParticleEmitterOptions {
  /** Texture / sprite name for each particle (display layer handles actual rendering). */
  texture?: string;
  emissionRate?: number;
  lifetime?: {
    min: number;
    max: number;
  };
  velocity?: {
    x?: {
      min: number;
      max: number;
    };
    y?: {
      min: number;
      max: number;
    };
  };
  acceleration?: {
    x?: number;
    y?: number;
  };
  startScale?: number;
  endScale?: number;
  /**
   * Per-step random fluctuation applied to a particle's scale, on top of
   * the deterministic `startScale`->`endScale` ramp — GameMaker's
   * `part_type_size`'s `size_wiggle` parameter. Each step, a fresh random
   * offset in `[-sizeWiggle, sizeWiggle]` is added to the particle's
   * interpolated scale; the offset itself is redrawn every step (real
   * step-to-step randomness, not a fixed per-particle phase), matching
   * GameMaker's own "wiggle" semantic of continuous jitter rather than a
   * smooth oscillation. `0` (the default) disables it entirely.
   */
  sizeWiggle?: number;
  startAlpha?: number;
  endAlpha?: number;
  colorGradient?: number[];
  shape?: EmitterShape;
  shapeRadius?: number;
  shapeWidth?: number;
  shapeHeight?: number;
  rotationSpeed?: number;
  maxParticles?: number;
  /**
   * Per-step random fluctuation applied to a particle's current speed
   * (its velocity vector's magnitude), on top of `acceleration` —
   * GameMaker's `part_type_speed`'s `speed_wiggle` parameter. Same
   * "redrawn every step" semantic as `sizeWiggle`. `0` (the default)
   * disables it.
   */
  speedWiggle?: number;
  /**
   * Per-step random fluctuation applied to a particle's current direction
   * of travel, in degrees — GameMaker's `part_type_direction`'s
   * `dir_wiggle` parameter. Same "redrawn every step" semantic as
   * `sizeWiggle`. `0` (the default) disables it.
   */
  dirWiggle?: number;
  /**
   * Blend mode every particle in this emitter renders with — see
   * `ParticleBlendMode`'s doc comment. `"normal"` (the default) is
   * ordinary alpha blending; `"add"` is additive blending, the common
   * "glowing embers/fire" look GameMaker's `part_type_blend(ind, true)`
   * produces.
   */
  blendMode?: ParticleBlendMode;
}
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
  life: number;
  maxLife: number;
  scale: number;
  startScale: number;
  endScale: number;
  alpha: number;
  startAlpha: number;
  endAlpha: number;
  rotation: number;
  rotationSpeed: number;
  colour: number;
  active: boolean;
}
export declare class ParticleEmitter {
  x: number;
  y: number;
  readonly options: Required<ParticleEmitterOptions>;
  private readonly _particles;
  private _accumulator;
  private _activeCount;
  /** Cycles through the pool so each spawn starts near the last freed slot. */
  private _nextSlot;
  active: boolean;
  constructor(options?: ParticleEmitterOptions);
  /** Burst-emit N particles immediately. */
  emit(count: number): void;
  private _spawnOne;
  update(deltaTime: number): void;
  /** Read-only snapshot of active particles for the render layer. */
  getParticles(): ReadonlyArray<Particle>;
  get activeCount(): number;
  stop(): void;
  clear(): void;
}
export declare class ParticleSystem {
  private readonly _emitters;
  create(options?: ParticleEmitterOptions): ParticleEmitter;
  remove(emitter: ParticleEmitter): void;
  update(deltaTime: number): void;
  get emitters(): ReadonlySet<ParticleEmitter>;
  clear(): void;
  destroy(): void;
}
export {};

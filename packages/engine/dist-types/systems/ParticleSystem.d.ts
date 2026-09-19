export type EmitterShape = "point" | "circle" | "rectangle" | "line";
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
  startAlpha?: number;
  endAlpha?: number;
  colorGradient?: number[];
  shape?: EmitterShape;
  shapeRadius?: number;
  shapeWidth?: number;
  shapeHeight?: number;
  rotationSpeed?: number;
  maxParticles?: number;
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

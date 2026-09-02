// ─── Colour gradient ─────────────────────────────────────────────────────────

function hexToRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
}

function lerpColour(a: number, b: number, t: number): number {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

function sampleGradient(colours: number[], t: number): number {
  if (colours.length === 0) return 0xffffff;
  if (colours.length === 1) return colours[0] ?? colours[colours.length - 1] ?? 0xffffff;
  const seg = 1 / (colours.length - 1);
  const idx = Math.min(Math.floor(t / seg), colours.length - 2);
  const local = (t - idx * seg) / seg;
  const ca = colours[idx] ?? 0xffffff;
  const cb = colours[idx + 1] ?? 0xffffff;
  return lerpColour(ca, cb, local);
}

// ─── Emitter options ─────────────────────────────────────────────────────────

export type EmitterShape = 'point' | 'circle' | 'rectangle' | 'line';

export interface ParticleEmitterOptions {
  /** Texture / sprite name for each particle (display layer handles actual rendering). */
  texture?: string;
  emissionRate?: number;
  lifetime?: { min: number; max: number };
  velocity?: {
    x?: { min: number; max: number };
    y?: { min: number; max: number };
  };
  acceleration?: { x?: number; y?: number };
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

// ─── Particle ─────────────────────────────────────────────────────────────────

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  ax: number; ay: number;
  life: number; maxLife: number;
  scale: number; startScale: number; endScale: number;
  alpha: number; startAlpha: number; endAlpha: number;
  rotation: number; rotationSpeed: number;
  colour: number;
  active: boolean;
}

function rng(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// ─── Emitter ─────────────────────────────────────────────────────────────────

export class ParticleEmitter {
  public x: number = 0;
  public y: number = 0;
  public readonly options: Required<ParticleEmitterOptions>;
  private readonly _particles: Particle[] = [];
  private _accumulator: number = 0;
  public active: boolean = true;

  constructor(options: ParticleEmitterOptions = {}) {
    this.options = {
      texture: options.texture ?? '',
      emissionRate: options.emissionRate ?? 20,
      lifetime: options.lifetime ?? { min: 0.5, max: 1.5 },
      velocity: options.velocity ?? { x: { min: -50, max: 50 }, y: { min: -100, max: -50 } },
      acceleration: options.acceleration ?? { x: 0, y: 100 },
      startScale: options.startScale ?? 1,
      endScale: options.endScale ?? 0,
      startAlpha: options.startAlpha ?? 1,
      endAlpha: options.endAlpha ?? 0,
      colorGradient: options.colorGradient ?? [0xffffff],
      shape: options.shape ?? 'point',
      shapeRadius: options.shapeRadius ?? 0,
      shapeWidth: options.shapeWidth ?? 0,
      shapeHeight: options.shapeHeight ?? 0,
      rotationSpeed: options.rotationSpeed ?? 0,
      maxParticles: options.maxParticles ?? 500,
    };
  }

  /** Burst-emit N particles immediately. */
  emit(count: number): void {
    for (let i = 0; i < count; i++) {
      this._spawnOne();
    }
  }

  private _spawnOne(): void {
    if (this._particles.filter(p => p.active).length >= this.options.maxParticles) return;

    const opts = this.options;
    const life = rng(opts.lifetime.min, opts.lifetime.max);

    let ox = 0; let oy = 0;
    if (opts.shape === 'circle' && opts.shapeRadius > 0) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * opts.shapeRadius;
      ox = Math.cos(a) * r; oy = Math.sin(a) * r;
    } else if (opts.shape === 'rectangle') {
      ox = rng(-opts.shapeWidth / 2, opts.shapeWidth / 2);
      oy = rng(-opts.shapeHeight / 2, opts.shapeHeight / 2);
    }

    const p: Particle = {
      x: this.x + ox,
      y: this.y + oy,
      vx: rng(opts.velocity.x?.min ?? 0, opts.velocity.x?.max ?? 0),
      vy: rng(opts.velocity.y?.min ?? 0, opts.velocity.y?.max ?? 0),
      ax: opts.acceleration.x ?? 0,
      ay: opts.acceleration.y ?? 0,
      life,
      maxLife: life,
      scale: opts.startScale,
      startScale: opts.startScale,
      endScale: opts.endScale,
      alpha: opts.startAlpha,
      startAlpha: opts.startAlpha,
      endAlpha: opts.endAlpha,
      rotation: 0,
      rotationSpeed: opts.rotationSpeed,
      colour: sampleGradient(opts.colorGradient, 0),
      active: true,
    };

    const slot = this._particles.findIndex(p => !p.active);
    if (slot !== -1) {
      this._particles[slot] = p;
    } else {
      this._particles.push(p);
    }
  }

  update(deltaTime: number): void {
    if (this.active) {
      this._accumulator += deltaTime;
      const interval = 1 / this.options.emissionRate;
      while (this._accumulator >= interval) {
        this._spawnOne();
        this._accumulator -= interval;
      }
    }

    for (const p of this._particles) {
      if (!p.active) continue;
      p.life -= deltaTime;
      if (p.life <= 0) { p.active = false; continue; }

      const t = 1 - p.life / p.maxLife;
      p.vx += p.ax * deltaTime;
      p.vy += p.ay * deltaTime;
      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;
      p.rotation += p.rotationSpeed * deltaTime;
      p.scale = p.startScale + (p.endScale - p.startScale) * t;
      p.alpha = p.startAlpha + (p.endAlpha - p.startAlpha) * t;
      p.colour = sampleGradient(this.options.colorGradient, t);
    }
  }

  /** Read-only snapshot of active particles for the render layer. */
  getParticles(): ReadonlyArray<Particle> {
    return this._particles;
  }

  get activeCount(): number {
    return this._particles.filter(p => p.active).length;
  }

  stop(): void {
    this.active = false;
  }

  clear(): void {
    this._particles.length = 0;
    this._accumulator = 0;
  }
}

// ─── System singleton ─────────────────────────────────────────────────────────

class ParticleSystemImpl {
  private readonly _emitters: ParticleEmitter[] = [];

  create(options: ParticleEmitterOptions = {}): ParticleEmitter {
    const emitter = new ParticleEmitter(options);
    this._emitters.push(emitter);
    return emitter;
  }

  destroy(emitter: ParticleEmitter): void {
    const idx = this._emitters.indexOf(emitter);
    if (idx !== -1) {
      emitter.clear();
      this._emitters.splice(idx, 1);
    }
  }

  update(deltaTime: number): void {
    for (const emitter of this._emitters) {
      emitter.update(deltaTime);
    }
  }

  get emitters(): ReadonlyArray<ParticleEmitter> {
    return this._emitters;
  }

  clear(): void {
    this._emitters.length = 0;
  }
}

export const ParticleSystem = new ParticleSystemImpl();

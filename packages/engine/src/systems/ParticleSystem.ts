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
  if (colours.length === 1)
    return colours[0] ?? colours[colours.length - 1] ?? 0xffffff;
  const seg = 1 / (colours.length - 1);
  const idx = Math.min(Math.floor(t / seg), colours.length - 2);
  const local = (t - idx * seg) / seg;
  const ca = colours[idx] ?? 0xffffff;
  const cb = colours[idx + 1] ?? 0xffffff;
  return lerpColour(ca, cb, local);
}

// ─── Emitter options ─────────────────────────────────────────────────────────

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
  lifetime?: { min: number; max: number };
  velocity?: {
    x?: { min: number; max: number };
    y?: { min: number; max: number };
  };
  acceleration?: { x?: number; y?: number };
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

// ─── Particle ─────────────────────────────────────────────────────────────────

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
  private _activeCount: number = 0;
  /** Cycles through the pool so each spawn starts near the last freed slot. */
  private _nextSlot: number = 0;
  public active: boolean = true;

  constructor(options: ParticleEmitterOptions = {}) {
    this.options = {
      texture: options.texture ?? "",
      emissionRate: options.emissionRate ?? 20,
      lifetime: options.lifetime ?? { min: 0.5, max: 1.5 },
      velocity: options.velocity ?? {
        x: { min: -50, max: 50 },
        y: { min: -100, max: -50 },
      },
      acceleration: options.acceleration ?? { x: 0, y: 100 },
      startScale: options.startScale ?? 1,
      endScale: options.endScale ?? 0,
      sizeWiggle: options.sizeWiggle ?? 0,
      startAlpha: options.startAlpha ?? 1,
      endAlpha: options.endAlpha ?? 0,
      colorGradient: options.colorGradient ?? [0xffffff],
      shape: options.shape ?? "point",
      shapeRadius: options.shapeRadius ?? 0,
      shapeWidth: options.shapeWidth ?? 0,
      shapeHeight: options.shapeHeight ?? 0,
      rotationSpeed: options.rotationSpeed ?? 0,
      maxParticles: options.maxParticles ?? 500,
      speedWiggle: options.speedWiggle ?? 0,
      dirWiggle: options.dirWiggle ?? 0,
      blendMode: options.blendMode ?? "normal",
    };
  }

  /** Burst-emit N particles immediately. */
  emit(count: number): void {
    for (let i = 0; i < count; i++) {
      this._spawnOne();
    }
  }

  private _spawnOne(): void {
    if (this._activeCount >= this.options.maxParticles) return;

    const opts = this.options;
    const life = rng(opts.lifetime.min, opts.lifetime.max);

    let ox = 0;
    let oy = 0;
    if (opts.shape === "circle" && opts.shapeRadius > 0) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * opts.shapeRadius;
      ox = Math.cos(a) * r;
      oy = Math.sin(a) * r;
    } else if (opts.shape === "rectangle") {
      ox = rng(-opts.shapeWidth / 2, opts.shapeWidth / 2);
      oy = rng(-opts.shapeHeight / 2, opts.shapeHeight / 2);
    } else if (opts.shape === "line") {
      // Spawns along a horizontal line of length shapeWidth, centred on (x, y)
      ox = rng(-opts.shapeWidth / 2, opts.shapeWidth / 2);
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

    // Cycling scan from _nextSlot for amortised O(1) slot lookup.
    const len = this._particles.length;
    let slot = -1;
    for (let i = 0; i < len; i++) {
      const idx = (this._nextSlot + i) % len;
      const candidate = this._particles[idx];
      if (candidate !== undefined && !candidate.active) {
        slot = idx;
        break;
      }
    }
    if (slot !== -1) {
      this._particles[slot] = p;
    } else {
      slot = this._particles.length;
      this._particles.push(p);
    }
    this._nextSlot = (slot + 1) % this._particles.length;
    this._activeCount++;
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
      if (p.life <= 0) {
        p.active = false;
        this._activeCount--;
        continue;
      }

      const t = 1 - p.life / p.maxLife;
      p.vx += p.ax * deltaTime;
      p.vy += p.ay * deltaTime;

      // Speed/direction wiggle: a fresh random offset drawn every step (not
      // a fixed per-particle phase), applied on top of the deterministic
      // acceleration integration above — GameMaker's own `speed_wiggle`/
      // `dir_wiggle` semantic. Recomputing the polar form each step is
      // deliberate: it lets the wiggle perturb the velocity vector that
      // acceleration/gravity has already shaped this step, rather than
      // fighting it.
      if (this.options.speedWiggle > 0 || this.options.dirWiggle > 0) {
        const speed = Math.hypot(p.vx, p.vy);
        const angle = Math.atan2(p.vy, p.vx);
        const speedOffset =
          this.options.speedWiggle > 0
            ? rng(-this.options.speedWiggle, this.options.speedWiggle)
            : 0;
        const dirOffsetRad =
          this.options.dirWiggle > 0
            ? (rng(-this.options.dirWiggle, this.options.dirWiggle) * Math.PI) /
              180
            : 0;
        const newSpeed = Math.max(0, speed + speedOffset);
        const newAngle = angle + dirOffsetRad;
        p.vx = Math.cos(newAngle) * newSpeed;
        p.vy = Math.sin(newAngle) * newSpeed;
      }

      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;
      p.rotation += p.rotationSpeed * deltaTime;
      p.scale = p.startScale + (p.endScale - p.startScale) * t;
      // Size wiggle: same "redrawn every step" random offset, added on top
      // of the deterministic start->end scale ramp — never applied to
      // `startScale`/`endScale` themselves, matching GameMaker's own
      // `size_wiggle` acting as continuous jitter around the interpolated
      // curve rather than perturbing the curve's endpoints.
      if (this.options.sizeWiggle > 0) {
        p.scale = Math.max(
          0,
          p.scale + rng(-this.options.sizeWiggle, this.options.sizeWiggle),
        );
      }
      p.alpha = p.startAlpha + (p.endAlpha - p.startAlpha) * t;
      p.colour = sampleGradient(this.options.colorGradient, t);
    }
  }

  /** Read-only snapshot of active particles for the render layer. */
  getParticles(): ReadonlyArray<Particle> {
    return this._particles;
  }

  get activeCount(): number {
    return this._activeCount;
  }

  stop(): void {
    this.active = false;
  }

  clear(): void {
    this._particles.length = 0;
    this._accumulator = 0;
    this._activeCount = 0;
    this._nextSlot = 0;
  }
}

// ─── System ───────────────────────────────────────────────────────────────────

export class ParticleSystem {
  private readonly _emitters: Set<ParticleEmitter> = new Set();

  create(options: ParticleEmitterOptions = {}): ParticleEmitter {
    const emitter = new ParticleEmitter(options);
    this._emitters.add(emitter);
    return emitter;
  }

  remove(emitter: ParticleEmitter): void {
    if (this._emitters.delete(emitter)) {
      emitter.clear();
    }
  }

  update(deltaTime: number): void {
    for (const emitter of this._emitters) {
      emitter.update(deltaTime);
    }
  }

  get emitters(): ReadonlySet<ParticleEmitter> {
    return this._emitters;
  }

  clear(): void {
    this._emitters.clear();
  }

  destroy(): void {
    this.clear();
  }
}

// ─── Presets ─────────────────────────────────────────────────────────────────

export interface RainPresetOptions {
  /** Width of the emission strip (usually the viewport width). Default 800. */
  width?: number;
  /** Rain density, drops per second. Default 300. */
  density?: number;
  /** Wind push in px/s² (positive = right). Default 0. */
  wind?: number;
  /** Texture id for the streak sprite. Default "" (renderer falls back to white). */
  texture?: string;
}

/**
 * Ready-made rain `ParticleEmitterOptions`: a line emitter across the top of
 * the screen firing fast, slightly tilted, short-lived, low-alpha drops.
 * Position the emitter just above the top edge of the view.
 */
export function rainParticlePreset(
  opts: RainPresetOptions = {},
): ParticleEmitterOptions {
  const wind = opts.wind ?? 0;
  return {
    texture: opts.texture ?? "",
    shape: "line",
    shapeWidth: opts.width ?? 800,
    emissionRate: opts.density ?? 300,
    lifetime: { min: 0.6, max: 0.9 },
    velocity: {
      x: { min: wind * 0.05 - 20, max: wind * 0.05 + 20 },
      y: { min: 700, max: 950 },
    },
    acceleration: { x: wind, y: 0 },
    startScale: 0.6,
    endScale: 0.5,
    startAlpha: 0.55,
    endAlpha: 0.25,
    colorGradient: [0xcfe3ff, 0x9fc0e8],
    maxParticles: 1200,
    blendMode: "normal",
  };
}

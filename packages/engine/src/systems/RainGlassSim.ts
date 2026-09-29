// Pure CPU simulation behind the windshield rain effect (no pixi, no DOM).
// Drops live in a pooled struct-of-arrays (zero per-frame allocation) in
// "map pixels", the resolution of the drop-map texture the filter uploads.
// Everything is deterministic given the seed and the sequence of dt values:
// fixed substeps, a seeded RNG (never Math.random), ascending-index passes.

/** mulberry32 with its state in a Uint32Array so it can be saved and restored. */
export class Rng {
  private readonly _s = new Uint32Array(1);

  constructor(seed: number) {
    this._s[0] = seed >>> 0;
  }

  /** Float in [0, 1). */
  next(): number {
    const s = (this._s[0]! + 0x6d2b79f5) >>> 0;
    this._s[0] = s;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  getState(): number {
    return this._s[0]!;
  }

  setState(state: number): void {
    this._s[0] = state >>> 0;
  }
}

/** Fixed-capacity pool of drops with a free-list stack. */
export class DropPool {
  readonly capacity: number;
  readonly x: Float32Array;
  readonly y: Float32Array;
  /** Radius in map px. */
  readonly r: Float32Array;
  readonly vy: Float32Array;
  readonly vx: Float32Array;
  /** Seconds before the drop may slide. */
  readonly stick: Float32Array;
  /** Distance travelled since the last trail bead. */
  readonly trailAcc: Float32Array;
  readonly alive: Uint8Array;
  /** 1 for trail beads (counted against the tier bead cap). */
  readonly bead: Uint8Array;
  readonly free: Uint16Array;
  freeTop: number;
  count = 0;

  constructor(capacity: number) {
    this.capacity = Math.max(1, Math.min(65535, capacity | 0));
    const n = this.capacity;
    this.x = new Float32Array(n);
    this.y = new Float32Array(n);
    this.r = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.vx = new Float32Array(n);
    this.stick = new Float32Array(n);
    this.trailAcc = new Float32Array(n);
    this.alive = new Uint8Array(n);
    this.bead = new Uint8Array(n);
    this.free = new Uint16Array(n);
    this.freeTop = n;
    for (let k = 0; k < n; k++) this.free[k] = n - 1 - k; // pops lowest index first
  }

  /** Returns a slot index or -1 when full. */
  alloc(): number {
    if (this.freeTop === 0) return -1;
    const i = this.free[--this.freeTop]!;
    this.alive[i] = 1;
    this.bead[i] = 0;
    this.vx[i] = 0;
    this.vy[i] = 0;
    this.stick[i] = 0;
    this.trailAcc[i] = 0;
    this.count++;
    return i;
  }

  release(i: number): void {
    if (this.alive[i] === 0) return;
    this.alive[i] = 0;
    this.free[this.freeTop++] = i;
    this.count--;
  }

  clear(): void {
    const n = this.capacity;
    this.alive.fill(0);
    this.count = 0;
    this.freeTop = n;
    for (let k = 0; k < n; k++) this.free[k] = n - 1 - k;
  }
}

export interface RainGlassSimOptions {
  /** Map width in px. */
  width: number;
  /** Map height in px. */
  height: number;
  /** Pool capacity. */
  maxDrops: number;
  /** Spawns per second at intensity 1. */
  spawnPerSec: number;
  /** RNG seed. Default 1. */
  seed?: number;
  /** 0..1 spawn rate scale. Default 0.6. */
  intensity?: number;
  /** Scales spawned radii (1 = default; the legacy 0.12 default maps to 1). */
  sizeScale?: number;
  /** Fixed substep length in seconds. Default 1/60. */
  stepSec?: number;
  /** Evaporation, map-height-relative radius loss per second for static drops. Default 0.02. */
  evapRate?: number;
}

const MAX_FRAME_DT = 1 / 20;

export class RainGlassSim {
  readonly width: number;
  readonly height: number;
  readonly pool: DropPool;
  readonly rng: Rng;
  readonly stepSec: number;
  readonly spawnPerSec: number;

  intensity: number;
  sizeScale: number;
  evapRate: number;
  /** Total drops ever spawned by the spawner (not counting beads or addDrop). */
  spawned = 0;
  simTime = 0;

  /** Geometry unit: map height / 144, so tuning constants are resolution independent. */
  readonly unit: number;
  readonly rMin: number;
  readonly rMax: number;
  readonly rSlide: number;

  protected _acc = 0;
  protected _spawnAcc = 0;

  constructor(opts: RainGlassSimOptions) {
    this.width = Math.max(4, opts.width | 0);
    this.height = Math.max(4, opts.height | 0);
    this.pool = new DropPool(opts.maxDrops);
    this.rng = new Rng(opts.seed ?? 1);
    this.stepSec = opts.stepSec ?? 1 / 60;
    this.spawnPerSec = opts.spawnPerSec;
    this.intensity = opts.intensity ?? 0.6;
    this.sizeScale = opts.sizeScale ?? 1;
    this.unit = this.height / 144;
    this.evapRate = (opts.evapRate ?? 0.02) * this.unit;
    this.rMin = 1.0 * this.unit;
    this.rMax = 8 * this.unit;
    this.rSlide = 2.6 * this.unit;
  }

  get dropCount(): number {
    return this.pool.count;
  }

  /** Sum of r^3 over live drops (proportional to water volume). */
  totalVolume(): number {
    const p = this.pool;
    let v = 0;
    for (let i = 0; i < p.capacity; i++) {
      if (p.alive[i] === 1) v += p.r[i]! * p.r[i]! * p.r[i]!;
    }
    return v;
  }

  /** Places a drop directly (tests, scripted scenes). Returns the slot or -1. */
  addDrop(x: number, y: number, r: number, stick = 0): number {
    const i = this.pool.alloc();
    if (i < 0) return -1;
    this.pool.x[i] = x;
    this.pool.y[i] = y;
    this.pool.r[i] = r;
    this.pool.stick[i] = stick;
    return i;
  }

  /** Advances by `dtSeconds` (clamped) in fixed substeps. */
  step(dtSeconds: number): void {
    const dt = Math.min(Math.max(dtSeconds, 0), MAX_FRAME_DT);
    this._acc += dt;
    while (this._acc >= this.stepSec) {
      this._acc -= this.stepSec;
      this._substep(this.stepSec);
    }
  }

  protected _substep(dt: number): void {
    this.simTime += dt;
    this._spawn(dt);
    this._update(dt);
    this._cull();
  }

  protected _spawn(dt: number): void {
    this._spawnAcc += this.intensity * this.spawnPerSec * dt;
    const p = this.pool;
    while (this._spawnAcc >= 1) {
      this._spawnAcc -= 1;
      if (p.freeTop === 0) {
        this._spawnAcc = 0;
        return;
      }
      const u = this.rng.next();
      const r =
        (this.rMin + (this.rMax - this.rMin) * u * u * u) * this.sizeScale;
      const x = this.rng.next() * this.width;
      const y = this.rng.next() * this.height * 0.85;
      const stick = this.rng.next() * 2 + (r / this.unit) * 0.15;
      this.addDrop(x, y, r, stick);
      this.spawned++;
    }
  }

  /** Per-substep motion, merging and evaporation; extended by later phases. */
  protected _update(dt: number): void {
    const p = this.pool;
    for (let i = 0; i < p.capacity; i++) {
      if (p.alive[i] === 0) continue;
      if (p.stick[i]! > 0) p.stick[i] = p.stick[i]! - dt;
      if (p.vy[i] === 0) p.r[i] = p.r[i]! - this.evapRate * dt;
    }
  }

  protected _cull(): void {
    const p = this.pool;
    for (let i = 0; i < p.capacity; i++) {
      if (p.alive[i] === 0) continue;
      if (p.r[i]! < 0.4 * this.unit || p.y[i]! - p.r[i]! > this.height) {
        this._free(i);
      }
    }
  }

  protected _free(i: number): void {
    this.pool.release(i);
  }
}

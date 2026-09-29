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
  /** Gravity scale, 0 (flat) to 1 (vertical glass). Default 1. */
  slope?: number;
  /** Lateral drift in map px/s at unit scale. Default 0. */
  wind?: number;
  /** Scales slide speed (legacy dropletSpeed / 0.35). Default 1. */
  speedScale?: number;
  /** Scales trail wet stamp and shed rate (legacy streakAmount / 0.5). 0 disables trails. Default 1. */
  trailScale?: number;
  /** Max simultaneous trail beads; 0 leaves trails to the wet map only. Default 0. */
  beadCap?: number;
  /** Whether sliding drops stamp the wet map and shed volume. Default true. */
  trails?: boolean;
  /** Target condensation 0..1. Default 0. */
  fog?: number;
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
  slope: number;
  wind: number;
  speedScale: number;
  trailScale: number;
  beadCap: number;
  trails: boolean;
  fogTarget: number;
  /** Eased condensation 0..1. */
  fog: number;
  /** Live trail bead count. */
  beadCount = 0;
  /** Smear-trail height 0..255 per map px, decays over time. */
  readonly wet: Uint8Array;

  /** Geometry unit: map height / 144, so tuning constants are resolution independent. */
  readonly unit: number;
  readonly rMin: number;
  readonly rMax: number;
  readonly rSlide: number;

  protected readonly _heads: Int16Array;
  protected readonly _next: Int16Array;
  protected _frame = 0;
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
    this.slope = opts.slope ?? 1;
    this.wind = opts.wind ?? 0;
    this.speedScale = opts.speedScale ?? 1;
    this.trailScale = opts.trailScale ?? 1;
    this.beadCap = opts.beadCap ?? 0;
    this.trails = opts.trails ?? true;
    this.fogTarget = opts.fog ?? 0;
    this.fog = this.fogTarget;
    this.wet = new Uint8Array(this.width * this.height);
    // Merge grid cells are never smaller than height/12, bounding the cell count.
    const maxCells = (Math.ceil((12 * this.width) / this.height) + 2) * 14;
    this._heads = new Int16Array(maxCells);
    this._next = new Int16Array(this.pool.capacity);
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

  /** Per-substep motion, trails, merging, evaporation, fog and wet decay. */
  protected _update(dt: number): void {
    const p = this.pool;
    const u = this.unit;
    const vMax = 90 * u * this.slope * this.speedScale;
    const rs2 = (this.rSlide / u) * (this.rSlide / u);
    const rm2 = (this.rMax / u) * (this.rMax / u);
    const trailsOn = this.trails && this.trailScale > 0;
    const trailStep = (4 * u) / Math.max(this.trailScale, 0.01);
    const wetVal = Math.min(255, Math.round(200 * this.trailScale));
    const lerp = Math.min(1, dt * 4);
    for (let i = 0; i < p.capacity; i++) {
      if (p.alive[i] === 0) continue;
      if (p.stick[i]! > 0) p.stick[i] = p.stick[i]! - dt;
      const r = p.r[i]!;
      if (p.bead[i] === 0 && r >= this.rSlide && p.stick[i]! <= 0) {
        const rr = r / u;
        const norm = Math.min(1, Math.max(0, (rr * rr - rs2) / (rm2 - rs2)));
        const target = vMax * (0.15 + 0.85 * norm);
        p.vy[i] = p.vy[i]! + (target - p.vy[i]!) * lerp;
        p.vx[i] =
          this.wind * u + Math.sin(i * 12.9898 + this.simTime * 3) * 3 * u;
        const dx = p.vx[i]! * dt;
        const dy = p.vy[i]! * dt;
        p.x[i] = Math.min(this.width, Math.max(0, p.x[i]! + dx));
        p.y[i] = p.y[i]! + dy;
        p.trailAcc[i] = p.trailAcc[i]! + Math.sqrt(dx * dx + dy * dy);
        if (trailsOn) {
          this._stampWet(p.x[i]!, p.y[i]!, Math.max(0.8 * u, 0.3 * r), wetVal);
          if (p.trailAcc[i]! >= trailStep) {
            p.trailAcc[i] = p.trailAcc[i]! - trailStep;
            this._shed(i, r);
          }
        }
        if (p.r[i]! < this.rSlide) {
          p.vy[i] = 0;
          p.vx[i] = 0;
        }
      } else {
        p.vy[i] = 0;
        p.vx[i] = 0;
        p.r[i] = r - this.evapRate * dt * (p.bead[i] === 1 ? 2 : 1);
      }
    }
    this._merge();
    this.fog += (this.fogTarget - this.fog) * Math.min(1, dt * 0.5);
    if ((this._frame++ & 3) === 3) this._decayWet(2);
  }

  /** A sliding drop loses a bead's worth of volume (a bead drop is left behind when allowed). */
  protected _shed(i: number, r: number): void {
    const p = this.pool;
    const b = 0.35 * r;
    const rNew = Math.cbrt(r * r * r - b * b * b);
    p.r[i] = rNew;
    if (
      this.beadCap > 0 &&
      this.beadCount < this.beadCap &&
      b >= 0.5 * this.unit
    ) {
      const k = p.alloc();
      if (k >= 0) {
        p.x[k] = p.x[i]!;
        p.y[k] = p.y[i]! - (rNew + b);
        p.r[k] = b;
        p.stick[k] = 1e6;
        p.bead[k] = 1;
        this.beadCount++;
      }
    }
  }

  protected _stampWet(cx: number, cy: number, rad: number, val: number): void {
    const w = this.width;
    const h = this.height;
    const x0 = Math.max(0, Math.floor(cx - rad));
    const x1 = Math.min(w - 1, Math.ceil(cx + rad));
    const y0 = Math.max(0, Math.floor(cy - rad));
    const y1 = Math.min(h - 1, Math.ceil(cy + rad));
    const r2 = rad * rad;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r2) {
          const k = y * w + x;
          if (this.wet[k]! < val) this.wet[k] = val;
        }
      }
    }
  }

  protected _decayWet(amount: number): void {
    const wet = this.wet;
    for (let k = 0; k < wet.length; k++) {
      const v = wet[k]!;
      if (v > 0) wet[k] = v > amount ? v - amount : 0;
    }
  }

  /** Merges overlapping pairs (distance < 0.8 * sum of radii), conserving volume. */
  protected _merge(): void {
    const p = this.pool;
    const heads = this._heads;
    const next = this._next;
    for (let pass = 0; pass < 8; pass++) {
      let maxR = 0;
      for (let i = 0; i < p.capacity; i++) {
        if (p.alive[i] === 1 && p.r[i]! > maxR) maxR = p.r[i]!;
      }
      const cell = Math.max(1.6 * maxR, this.height / 12);
      const cols = Math.ceil(this.width / cell) + 1;
      const rows = Math.ceil(this.height / cell) + 1;
      const cells = cols * rows;
      if (cells > heads.length) return;
      heads.fill(-1, 0, cells);
      for (let i = p.capacity - 1; i >= 0; i--) {
        if (p.alive[i] === 0) continue;
        const c = this._cellOf(p.x[i]!, p.y[i]!, cell, cols, rows);
        next[i] = heads[c]!;
        heads[c] = i;
      }
      let merged = false;
      for (let i = 0; i < p.capacity; i++) {
        if (p.alive[i] === 0) continue;
        const cx = Math.min(cols - 1, Math.max(0, Math.floor(p.x[i]! / cell)));
        const cy = Math.min(rows - 1, Math.max(0, Math.floor(p.y[i]! / cell)));
        let done = false;
        for (let oy = -1; oy <= 1 && !done; oy++) {
          const gy = cy + oy;
          if (gy < 0 || gy >= rows) continue;
          for (let ox = -1; ox <= 1 && !done; ox++) {
            const gx = cx + ox;
            if (gx < 0 || gx >= cols) continue;
            for (let j = heads[gy * cols + gx]!; j >= 0; j = next[j]!) {
              if (j <= i || p.alive[j] === 0) continue;
              const dx = p.x[i]! - p.x[j]!;
              const dy = p.y[i]! - p.y[j]!;
              const lim = 0.8 * (p.r[i]! + p.r[j]!);
              if (dx * dx + dy * dy < lim * lim) {
                this._mergePair(i, j);
                merged = true;
                if (p.alive[i] === 0) done = true;
                break;
              }
            }
          }
        }
      }
      if (!merged) return;
    }
  }

  protected _cellOf(
    x: number,
    y: number,
    cell: number,
    cols: number,
    rows: number,
  ): number {
    const cx = Math.min(cols - 1, Math.max(0, Math.floor(x / cell)));
    const cy = Math.min(rows - 1, Math.max(0, Math.floor(y / cell)));
    return cy * cols + cx;
  }

  protected _mergePair(i: number, j: number): void {
    const p = this.pool;
    const vi = p.r[i]! * p.r[i]! * p.r[i]!;
    const vj = p.r[j]! * p.r[j]! * p.r[j]!;
    const keep = p.r[i]! >= p.r[j]! ? i : j;
    const other = keep === i ? j : i;
    const v = vi + vj;
    const wi = vi / v;
    const wj = vj / v;
    const bothBeads = p.bead[i] === 1 && p.bead[j] === 1;
    p.x[keep] = p.x[i]! * wi + p.x[j]! * wj;
    p.y[keep] = p.y[i]! * wi + p.y[j]! * wj;
    p.vy[keep] = p.vy[i]! * wi + p.vy[j]! * wj;
    p.vx[keep] = p.vx[i]! * wi + p.vx[j]! * wj;
    p.r[keep] = Math.cbrt(v);
    p.stick[keep] = 0;
    p.trailAcc[keep] = 0;
    this._free(other);
    if (!bothBeads && p.bead[keep] === 1) {
      p.bead[keep] = 0;
      this.beadCount--;
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
    if (this.pool.bead[i] === 1 && this.pool.alive[i] === 1) this.beadCount--;
    this.pool.release(i);
  }
}

/** mulberry32 with its state in a Uint32Array so it can be saved and restored. */
export declare class Rng {
  private readonly _s;
  constructor(seed: number);
  /** Float in [0, 1). */
  next(): number;
  getState(): number;
  setState(state: number): void;
}
/** Fixed-capacity pool of drops with a free-list stack. */
export declare class DropPool {
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
  count: number;
  constructor(capacity: number);
  /** Returns a slot index or -1 when full. */
  alloc(): number;
  release(i: number): void;
  clear(): void;
}
export interface WiperOptions {
  enabled: boolean;
  /** Pivot as a fraction of the view (0.5, 1.15 sits below the screen). */
  pivotX: number;
  pivotY: number;
  /** Arm length as a fraction of view height. */
  armLength: number;
  /** Sweep range in radians; 0 points straight up, positive is clockwise. */
  minAngle: number;
  maxAngle: number;
  /** Full out-and-back time in seconds. */
  periodSec: number;
  /** Blade width in map px. */
  bladeWidth: number;
  /** Park pause between sweeps when enabled. */
  pauseSec: number;
}
export interface RainGlassSimOptions {
  /** Wiper overrides. */
  wiper?: Partial<WiperOptions>;
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
export declare class RainGlassSim {
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
  spawned: number;
  simTime: number;
  slope: number;
  wind: number;
  speedScale: number;
  trailScale: number;
  beadCap: number;
  trails: boolean;
  fogTarget: number;
  /** Eased condensation 0..1. */
  fog: number;
  /** Wiper settings; mutate through setWiper. */
  readonly wiper: WiperOptions;
  /** Live trail bead count. */
  beadCount: number;
  /** Smear-trail height 0..255 per map px, decays over time. */
  readonly wet: Uint8Array;
  /** Geometry unit: map height / 144, so tuning constants are resolution independent. */
  readonly unit: number;
  readonly rMin: number;
  readonly rMax: number;
  readonly rSlide: number;
  protected readonly _heads: Int16Array;
  protected readonly _next: Int16Array;
  protected _frame: number;
  protected _wiperAngle: number;
  protected _wiperTime: number;
  protected _wiperOneShot: boolean;
  protected _acc: number;
  protected _spawnAcc: number;
  constructor(opts: RainGlassSimOptions);
  get dropCount(): number;
  /** Sum of r^3 over live drops (proportional to water volume). */
  totalVolume(): number;
  /** Places a drop directly (tests, scripted scenes). Returns the slot or -1. */
  addDrop(x: number, y: number, r: number, stick?: number): number;
  /** Advances by `dtSeconds` (clamped) in fixed substeps. */
  step(dtSeconds: number): void;
  protected _substep(dt: number): void;
  protected _spawn(dt: number): void;
  setWiper(patch: Partial<WiperOptions>): void;
  /** Runs one wiper sweep (out and back) even when the wiper is not enabled. */
  triggerWipe(): void;
  /** Current blade angle in radians, for a game-drawn blade. */
  get wiperAngle(): number;
  private _angleAt;
  protected _advanceWiper(dt: number): void;
  /** Clears drops and wet map under the blade at `angle`. */
  protected _wipeAt(angle: number): void;
  /** Per-substep motion, trails, merging, evaporation, fog and wet decay. */
  protected _update(dt: number): void;
  /** A sliding drop loses a bead's worth of volume (a bead drop is left behind when allowed). */
  protected _shed(i: number, r: number): void;
  protected _stampWet(cx: number, cy: number, rad: number, val: number): void;
  protected _decayWet(amount: number): void;
  /** Merges overlapping pairs (distance < 0.8 * sum of radii), conserving volume. */
  protected _merge(): void;
  protected _cellOf(
    x: number,
    y: number,
    cell: number,
    cols: number,
    rows: number,
  ): number;
  protected _mergePair(i: number, j: number): void;
  protected _cull(): void;
  protected _free(i: number): void;
}

/**
 * Shared fixed-timestep accumulation, extracted out
 * of `PhysicsSystem.ts` (2D) and `PhysicsSystem3D.ts`, which each kept a
 * near-identical copy of the same `_fixedTimestep`/`_accumulator`/`_alpha`
 * bookkeeping and while-loop. Behavior is unchanged — this is a pure
 * delete-duplication refactor: `dt` (real frame time) accumulates and
 * `stepFn` runs zero or more times at exactly `fixedTimestep` seconds each,
 * leaving `alpha` as the fractional remainder (0..1) for a renderer to
 * interpolate with.
 */
export class FixedTimestepAccumulator {
  private _fixedTimestep: number;
  private _accumulator = 0;
  private _alpha = 0;

  constructor(fixedTimestep = 1 / 60) {
    this._fixedTimestep = fixedTimestep;
  }

  get fixedTimestep(): number {
    return this._fixedTimestep;
  }

  set fixedTimestep(value: number) {
    this._fixedTimestep = value;
  }

  /** How far (0..1) the accumulator sits into the next step, after the last `advance()` call. */
  get alpha(): number {
    return this._alpha;
  }

  /** Accumulate `dt` and call `stepFn(fixedTimestep)` once per whole fixed step it covers. */
  advance(dt: number, stepFn: (fixedDt: number) => void): void {
    this._accumulator += dt;
    while (this._accumulator >= this._fixedTimestep) {
      stepFn(this._fixedTimestep);
      this._accumulator -= this._fixedTimestep;
    }
    this._alpha = this._accumulator / this._fixedTimestep;
  }

  /** Reset to a fresh accumulator — call alongside a physics world's own `destroy()`. */
  reset(): void {
    this._accumulator = 0;
    this._alpha = 0;
  }
}

/**
 * Generic interpolated-snapshot helper. 2D and 3D interpolate slightly
 * differently (3D lerps x/y/z and passes rotation through unlerped; 2D lerps
 * x/y/rotation), so this takes a caller-supplied `lerpFn` rather than forcing
 * one shape — it only owns the "look up the previous/current pair, or return
 * a fallback if unregistered" plumbing. `lookup` is a plain function rather
 * than requiring the caller's own per-entity state to be reshaped into a
 * `Map<K, {previous, current}>` first — both physics systems already keep
 * that pair embedded in a larger per-body record, and this avoids an
 * allocation on every call to recreate that shape.
 */
export function lerpSnapshot<K, S>(
  lookup: (key: K) => { previous: S; current: S } | undefined,
  key: K,
  alpha: number,
  fallback: () => S,
  lerpFn: (previous: S, current: S, alpha: number) => S,
): S {
  const snap = lookup(key);
  if (snap === undefined) return fallback();
  return lerpFn(snap.previous, snap.current, alpha);
}

import { describe, expect, it, vi } from "vitest";
import {
  FixedTimestepAccumulator,
  lerpSnapshot,
} from "../systems/FixedTimestepAccumulator.js";
import { getOrCreate, getOrCreateMapEntry } from "../internal/scoped.js";
import { setField, setFields } from "../internal/fields.js";

describe("FixedTimestepAccumulator (Finding 3)", () => {
  it("steps stepFn exactly once per whole fixedTimestep covered by dt, leaving a fractional alpha", () => {
    const acc = new FixedTimestepAccumulator(1 / 60);
    const steps: number[] = [];
    acc.advance(1 / 60, (fixedDt) => steps.push(fixedDt));
    expect(steps).toHaveLength(1);
    expect(acc.alpha).toBeCloseTo(0, 5);
  });

  it("accumulates a fractional remainder across sub-timestep frames, then steps once it clears the threshold", () => {
    const acc = new FixedTimestepAccumulator(1 / 50);
    const steps: number[] = [];
    acc.advance(1 / 60, (fixedDt) => steps.push(fixedDt)); // < 1/50, no step yet
    expect(steps).toHaveLength(0);
    expect(acc.alpha).toBeGreaterThan(0);
    expect(acc.alpha).toBeLessThan(1);

    acc.advance(1 / 60, (fixedDt) => steps.push(fixedDt));
    expect(steps.length).toBeGreaterThanOrEqual(1);
  });

  it("steps multiple times when dt covers several fixed timesteps at once", () => {
    const acc = new FixedTimestepAccumulator(1 / 60);
    const steps: number[] = [];
    acc.advance(3 / 60, (fixedDt) => steps.push(fixedDt));
    expect(steps).toHaveLength(3);
  });

  it("reset() zeroes the accumulator and alpha", () => {
    const acc = new FixedTimestepAccumulator(1 / 60);
    acc.advance(2.5 / 60, () => {});
    expect(acc.alpha).toBeGreaterThan(0);
    acc.reset();
    expect(acc.alpha).toBe(0);
  });
});

describe("lerpSnapshot (Finding 3 — shared by 2D and 3D interpolation)", () => {
  it("returns the fallback when the lookup finds nothing", () => {
    const result = lerpSnapshot<number, number>(
      () => undefined,
      1,
      0.5,
      () => -1,
      (prev, cur, a) => prev + (cur - prev) * a,
    );
    expect(result).toBe(-1);
  });

  it("interpolates via the caller-supplied lerpFn (2D-shaped: x/y/rotation)", () => {
    const snapshots = new Map([
      [1, { previous: { x: 0 }, current: { x: 10 } }],
    ]);
    const result = lerpSnapshot(
      (k: number) => snapshots.get(k),
      1,
      0.5,
      () => ({ x: -1 }),
      (prev, cur, a) => ({ x: prev.x + (cur.x - prev.x) * a }),
    );
    expect(result.x).toBe(5);
  });

  it("supports a 3D-shaped lerp that passes rotation through unlerped", () => {
    const snapshots = new Map([
      [
        1,
        {
          previous: { position: { x: 0 }, rotation: { w: 1 } },
          current: { position: { x: 4 }, rotation: { w: 0.5 } },
        },
      ],
    ]);
    const result = lerpSnapshot(
      (k: number) => snapshots.get(k),
      1,
      0.5,
      () => ({ position: { x: -1 }, rotation: { w: 1 } }),
      (prev, cur, a) => ({
        position: {
          x: prev.position.x + (cur.position.x - prev.position.x) * a,
        },
        rotation: cur.rotation, // unlerped, matching PhysicsSystem3D's behavior
      }),
    );
    expect(result.position.x).toBe(2);
    expect(result.rotation.w).toBe(0.5);
  });
});

describe("getOrCreate / getOrCreateMapEntry (Finding 4)", () => {
  it("creates once and reuses the same value for the same key", () => {
    const map = new WeakMap<object, number[]>();
    const key = {};
    const create = vi.fn(() => []);
    const a = getOrCreate(map, key, create);
    const b = getOrCreate(map, key, create);
    expect(a).toBe(b);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("getOrCreateMapEntry does the same for a plain Map", () => {
    const map = new Map<string, number[]>();
    const create = vi.fn(() => []);
    const a = getOrCreateMapEntry(map, "k", create);
    const b = getOrCreateMapEntry(map, "k", create);
    expect(a).toBe(b);
    expect(create).toHaveBeenCalledTimes(1);
  });
});

describe("setField / setFields (Finding 6)", () => {
  it("writes a value at index, creating the field array if absent", () => {
    const store: Record<string, unknown[]> = {};
    setField(store, "x", 3, 42);
    expect(store["x"]?.[3]).toBe(42);
  });

  it("setFields writes every entry of an object at the given index", () => {
    const store: Record<string, unknown[]> = { x: [], y: [1, 2] };
    setFields(store, 5, { x: 10, y: 20, z: 30 });
    expect(store["x"]?.[5]).toBe(10);
    expect(store["y"]?.[5]).toBe(20);
    expect(store["z"]?.[5]).toBe(30);
    // Pre-existing entries at other indices are untouched.
    expect(store["y"]?.[1]).toBe(2);
  });
});

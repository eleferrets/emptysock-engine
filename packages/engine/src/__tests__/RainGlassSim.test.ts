import { describe, it, expect } from "vitest";
import { DropPool, RainGlassSim, Rng } from "../systems/RainGlassSim.js";

function mk(seed = 1, extra: Partial<ConstructorParameters<typeof RainGlassSim>[0]> = {}) {
  return new RainGlassSim({
    width: 256,
    height: 144,
    maxDrops: 128,
    spawnPerSec: 24,
    seed,
    intensity: 1,
    ...extra,
  });
}

function snapshot(s: RainGlassSim): string {
  const p = s.pool;
  return [p.x, p.y, p.r, p.vy, p.vx, p.stick, p.alive]
    .map((a) => Array.from(new Uint8Array(a.buffer)).join(","))
    .join("|");
}

describe("Rng", () => {
  it("is deterministic per seed and in [0,1)", () => {
    const a = new Rng(5);
    const b = new Rng(5);
    for (let i = 0; i < 100; i++) {
      const v = a.next();
      expect(v).toBe(b.next());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(new Rng(6).next()).not.toBe(new Rng(5).next());
  });

  it("save/restore resumes the sequence", () => {
    const a = new Rng(9);
    a.next();
    const st = a.getState();
    const want = [a.next(), a.next()];
    const b = new Rng(1);
    b.setState(st);
    expect([b.next(), b.next()]).toEqual(want);
  });
});

describe("DropPool invariants", () => {
  it("alloc/release keep count + freeTop == capacity with no duplicate free slots", () => {
    const p = new DropPool(8);
    const got: number[] = [];
    for (let i = 0; i < 10; i++) got.push(p.alloc());
    expect(got.filter((v) => v >= 0)).toHaveLength(8);
    expect(got[8]).toBe(-1);
    p.release(3);
    p.release(3); // double release is a no-op
    p.release(5);
    expect(p.count + p.freeTop).toBe(p.capacity);
    const free = Array.from(p.free.slice(0, p.freeTop));
    expect(new Set(free).size).toBe(free.length);
  });
});

describe("RainGlassSim spawn and cull", () => {
  it("is byte-identical for the same seed and dt sequence, and differs by seed", () => {
    const run = (seed: number) => {
      const s = mk(seed);
      for (let i = 0; i < 600; i++) s.step(1 / 60);
      return snapshot(s);
    };
    expect(run(3)).toBe(run(3));
    expect(run(3)).not.toBe(run(4));
  });

  it("spawns within 10% of rate * t", () => {
    const s = mk(1, { maxDrops: 4096, evapRate: 0 });
    for (let i = 0; i < 60 * 20; i++) s.step(1 / 60);
    expect(s.spawned).toBeGreaterThan(24 * 20 * 0.9);
    expect(s.spawned).toBeLessThan(24 * 20 * 1.1);
  });

  it("never exceeds capacity and the free list stays consistent", () => {
    const s = mk(2, { maxDrops: 16 });
    for (let i = 0; i < 600; i++) {
      s.step(1 / 60);
      expect(s.pool.count).toBeLessThanOrEqual(16);
      expect(s.pool.count + s.pool.freeTop).toBe(16);
    }
  });

  it("frees drops past the bottom edge and evaporated drops", () => {
    const s = mk(1, { spawnPerSec: 0 });
    s.addDrop(10, 150, 3);
    s.addDrop(20, 50, 0.41);
    s.step(0.1);
    expect(s.dropCount).toBe(0);
  });

  it("clamps huge dt", () => {
    const s = mk(1);
    s.step(1000);
    expect(s.simTime).toBeLessThan(0.1);
  });
});

import { describe, it, expect } from "vitest";
import { DropPool, RainGlassSim, Rng } from "../systems/RainGlassSim.js";

function mk(
  seed = 1,
  extra: Partial<ConstructorParameters<typeof RainGlassSim>[0]> = {},
) {
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
    s.addDrop(20, 50, 0.401);
    s.step(0.1);
    expect(s.dropCount).toBe(0);
  });

  it("clamps huge dt", () => {
    const s = mk(1);
    s.step(1000);
    expect(s.simTime).toBeLessThan(0.1);
  });
});

describe("RainGlassSim slide, trails and merge", () => {
  const calm = { spawnPerSec: 0, evapRate: 0 };

  it("conserves volume (r^3) on merge", () => {
    const s = mk(1, calm);
    s.addDrop(50, 50, 3);
    s.addDrop(53, 50, 2.5);
    s.addDrop(100, 60, 4);
    const before = s.totalVolume();
    s.step(1 / 60);
    expect(s.dropCount).toBe(2);
    expect(Math.abs(s.totalVolume() - before) / before).toBeLessThan(1e-4);
  });

  it("leaves no overlapping pair after a step and keeps pool invariants", () => {
    const s = mk(7, { beadCap: 24 });
    for (let n = 0; n < 900; n++) {
      s.step(1 / 60);
      const p = s.pool;
      expect(p.count + p.freeTop).toBe(p.capacity);
      const free = Array.from(p.free.slice(0, p.freeTop));
      expect(new Set(free).size).toBe(free.length);
      if (n % 60 !== 0) continue;
      for (let i = 0; i < p.capacity; i++) {
        if (!p.alive[i]) continue;
        for (let j = i + 1; j < p.capacity; j++) {
          if (!p.alive[j]) continue;
          const d = Math.hypot(p.x[i]! - p.x[j]!, p.y[i]! - p.y[j]!);
          expect(d).toBeGreaterThanOrEqual(0.8 * (p.r[i]! + p.r[j]!) - 1e-3);
        }
      }
    }
    expect(s.beadCount).toBeLessThanOrEqual(24);
  });

  it("a lone sliding drop moves down, never grows, and stops below rSlide", () => {
    const s = mk(1, calm);
    const i = s.addDrop(100, 10, s.rMax);
    let prevR = s.pool.r[i]!;
    let prevY = s.pool.y[i]!;
    for (let n = 0; n < 60 * 10 && s.pool.alive[i]; n++) {
      s.step(1 / 60);
      if (!s.pool.alive[i]) break;
      expect(s.pool.r[i]!).toBeLessThanOrEqual(prevR + 1e-6);
      expect(s.pool.y[i]!).toBeGreaterThanOrEqual(prevY);
      prevR = s.pool.r[i]!;
      prevY = s.pool.y[i]!;
    }
    expect(prevY).toBeGreaterThan(10);
    if (s.pool.alive[i]) expect(s.pool.vy[i]).toBe(0);
  });

  it("stamps the wet map in [0,255] and decays it to zero", () => {
    const s = mk(1, calm);
    s.addDrop(100, 10, s.rMax);
    for (let n = 0; n < 60; n++) s.step(1 / 60);
    expect(s.wet.some((v) => v > 0)).toBe(true);
    s.pool.clear();
    for (let n = 0; n < 60 * 10; n++) s.step(1 / 60);
    expect(s.wet.every((v) => v === 0)).toBe(true);
  });

  it("slope 0 keeps drops still; trails off never touches the wet map", () => {
    const flat = mk(1, { ...calm, slope: 0 });
    const i = flat.addDrop(100, 10, flat.rMax);
    for (let n = 0; n < 60; n++) flat.step(1 / 60);
    expect(flat.pool.y[i]).toBe(10);
    const dry = mk(1, { ...calm, trails: false });
    dry.addDrop(100, 10, dry.rMax);
    for (let n = 0; n < 60; n++) dry.step(1 / 60);
    expect(dry.wet.every((v) => v === 0)).toBe(true);
  });

  it("sheds beads up to beadCap", () => {
    const s = mk(1, { ...calm, beadCap: 3 });
    s.addDrop(100, 0, s.rMax);
    for (let n = 0; n < 60 * 2; n++) s.step(1 / 60);
    expect(s.beadCount).toBeGreaterThan(0);
    expect(s.beadCount).toBeLessThanOrEqual(3);
  });

  it("eases fog toward its target", () => {
    const s = mk(1, { ...calm, fog: 0 });
    s.fog = 0;
    s.fogTarget = 1;
    for (let n = 0; n < 600; n++) s.step(1 / 60);
    expect(s.fog).toBeGreaterThan(0.9);
  });
});

describe("RainGlassSim wiper", () => {
  const base = { spawnPerSec: 0, evapRate: 0, slope: 0 };

  it("a disabled wiper is a no-op", () => {
    const s = mk(1, base);
    s.addDrop(128, 100, 4);
    s.wet.fill(255);
    for (let n = 0; n < 200; n++) s.step(1 / 60);
    expect(s.dropCount).toBe(1);
    expect(s.wet[0]).toBeGreaterThan(100);
    expect(s.wiperAngle).toBe(s.wiper.minAngle);
  });

  it("a full sweep clears drops and wet bytes in the swept area and keeps the angle in range", () => {
    const s = mk(1, { ...base, wiper: { enabled: true, periodSec: 1 } });
    s.addDrop(128, 100, 4);
    s.addDrop(60, 120, 3);
    s.wet.fill(255);
    let min = Infinity;
    let max = -Infinity;
    for (let n = 0; n < 40; n++) {
      s.step(1 / 60);
      min = Math.min(min, s.wiperAngle);
      max = Math.max(max, s.wiperAngle);
    }
    expect(min).toBeGreaterThanOrEqual(s.wiper.minAngle - 1e-9);
    expect(max).toBeLessThanOrEqual(s.wiper.maxAngle + 1e-9);
    expect(s.dropCount).toBe(0);
    // arm reaches the view centre column near the bottom
    expect(s.wet[100 * 256 + 128]).toBe(0);
    expect(s.wet[143 * 256 + 128]).toBe(0);
  });

  it("triggerWipe runs one sweep then parks", () => {
    const s = mk(1, { ...base, wiper: { periodSec: 0.5 } });
    s.addDrop(128, 100, 4);
    s.triggerWipe();
    let peak = s.wiperAngle;
    for (let n = 0; n < 60; n++) {
      s.step(1 / 60);
      peak = Math.max(peak, s.wiperAngle);
    }
    expect(peak).toBeGreaterThan(0.5);
    expect(s.wiperAngle).toBe(s.wiper.minAngle);
    expect(s.dropCount).toBe(0);
  });
});

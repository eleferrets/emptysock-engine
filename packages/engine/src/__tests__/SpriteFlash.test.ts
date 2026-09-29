import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as PixiJS from "pixi.js";
import { Texture } from "pixi.js";

vi.mock("pixi.js", async () => {
  const actual = await vi.importActual<typeof PixiJS>("pixi.js");
  return {
    ...actual,
    autoDetectRenderer: vi.fn(() =>
      Promise.resolve({
        canvas: {},
        render: vi.fn(),
        resize: vi.fn(),
        destroy: vi.fn(),
      }),
    ),
  };
});

const { RenderPipeline } = await import("../systems/RenderPipeline.js");
const { Scene } = await import("../Scene.js");
const { Transform } = await import("../components/Transform.js");
const { Sprite } = await import("../components/Sprite.js");
const { SpriteFlash, startSpriteFlash } =
  await import("../components/SpriteFlash.js");
const { SpriteFlashSystem, FlashFilterPool } =
  await import("../systems/SpriteFlashSystem.js");

describe("SpriteFlashSystem", () => {
  it("fades amount from peak to 0 and deactivates", () => {
    const scene = new Scene();
    const e = scene.spawn();
    const f = e.add(SpriteFlash, { duration: 1, peak: 0.8 });
    startSpriteFlash(f);
    expect(f.amount).toBeCloseTo(0.8);
    const sys = new SpriteFlashSystem();
    sys.update(scene, 0.5);
    expect(f.amount).toBeCloseTo(0.4);
    expect(f.active).toBe(true);
    sys.update(scene, 0.6);
    expect(f.amount).toBe(0);
    expect(f.active).toBe(false);
  });

  it("applies easing and ignores inactive flashes", () => {
    const scene = new Scene();
    const f = scene.spawn().add(SpriteFlash);
    new SpriteFlashSystem().update(scene, 1);
    expect(f.amount).toBe(0);
    startSpriteFlash(f, { duration: 1, easing: "quadIn", peak: 1 });
    new SpriteFlashSystem().update(scene, 0.5);
    expect(f.amount).toBeCloseTo(0.75); // 1 - 0.5^2
  });

  it("zero duration does not activate", () => {
    const scene = new Scene();
    const f = scene.spawn().add(SpriteFlash);
    startSpriteFlash(f, { duration: 0 });
    expect(f.active).toBe(false);
    expect(f.amount).toBe(0);
  });
});

describe("FlashFilterPool", () => {
  it("reuses released filters and sets uniforms", () => {
    const pool = new FlashFilterPool();
    const a = pool.acquire(0xff0000, 0.5);
    expect(a.alpha).toBe(0.5);
    expect(pool.liveCount).toBe(1);
    pool.release(a);
    expect(pool.liveCount).toBe(0);
    expect(pool.freeCount).toBe(1);
    expect(pool.acquire(0x00ff00, 1)).toBe(a);
  });
});

describe("RenderPipeline flash filter attachment", () => {
  let pipeline: InstanceType<typeof RenderPipeline>;
  let scene: InstanceType<typeof Scene>;
  const sprites = (): Map<number, { filters: readonly unknown[] | null }> =>
    (
      pipeline as unknown as {
        _tracking: Map<
          unknown,
          { sprites: Map<number, { filters: readonly unknown[] | null }> }
        >;
      }
    )._tracking.get(scene)?.sprites ?? new Map();

  beforeEach(async () => {
    pipeline = new RenderPipeline({
      textureLoader: vi.fn(() => Promise.resolve(Texture.WHITE)),
    });
    await pipeline.init();
    scene = new Scene();
  });

  it("attaches only while flashing, removes at zero, releases on destroy", () => {
    const e = scene.spawn();
    e.add(Transform);
    e.add(Sprite);
    const f = e.add(SpriteFlash);
    pipeline.syncEntities(scene);
    expect(sprites().get(e.eid)?.filters ?? null).toBeNull();
    expect(pipeline.activeFlashFilterCount).toBe(0);

    startSpriteFlash(f, { color: 0xffffff, duration: 1 });
    pipeline.syncEntities(scene);
    expect(sprites().get(e.eid)?.filters).toHaveLength(1);
    expect(pipeline.activeFlashFilterCount).toBe(1);

    f.amount = 0.3;
    pipeline.syncEntities(scene);
    expect(sprites().get(e.eid)?.filters).toHaveLength(1);
    expect(
      (sprites().get(e.eid)?.filters?.[0] as { alpha: number }).alpha,
    ).toBe(0.3);

    f.amount = 0;
    f.active = false;
    pipeline.syncEntities(scene);
    expect(sprites().get(e.eid)?.filters ?? null).toBeNull();
    expect(pipeline.activeFlashFilterCount).toBe(0);

    startSpriteFlash(f, { duration: 1 });
    pipeline.syncEntities(scene);
    expect(pipeline.activeFlashFilterCount).toBe(1);
    scene.destroy(e);
    pipeline.syncEntities(scene);
    expect(pipeline.activeFlashFilterCount).toBe(0);
  });
});

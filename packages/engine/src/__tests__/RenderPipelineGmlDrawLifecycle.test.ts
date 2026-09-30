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
const { GmlBehaviorState, registerGmlBehavior } =
  await import("../components/GmlBehavior.js");
const { GmlBehaviorSystem } = await import("../systems/GmlBehaviorSystem.js");

type Kid = { destroyed: boolean; parent: unknown };

describe("RenderPipeline gml draw target child lifecycle", () => {
  let pipeline: InstanceType<typeof RenderPipeline>;
  let scene: InstanceType<typeof Scene>;
  let eid = -1;
  let skipDraw = false;

  const kids = (): Kid[] =>
    (
      pipeline as unknown as {
        _gmlDrawGraphics: Map<number, { children: Kid[] }>;
      }
    )._gmlDrawGraphics.get(eid)?.children ?? [];

  beforeEach(async () => {
    skipDraw = false;
    registerGmlBehavior("leaky", {
      onDraw: (_e, ctx) => {
        if (skipDraw) return;
        ctx.drawTarget?.sprite("a.png", 1, 2);
        ctx.drawTarget?.text(3, 4, "hello");
      },
    });
    pipeline = new RenderPipeline({
      textureLoader: vi.fn(() => Promise.resolve(Texture.WHITE)),
    });
    await pipeline.init();
    scene = new Scene();
    const e = scene.spawn();
    eid = e.eid;
    e.add(Transform);
    e.add(Sprite);
    e.add(GmlBehaviorState, { behaviorId: "leaky" });
    pipeline.attachGmlBehaviors(new GmlBehaviorSystem(), { scene } as never);
  });

  it("destroys discarded non-label children and recycles labels instead of allocating", () => {
    pipeline.renderFrame(scene);
    const [sprite1, label1] = [...kids()];
    expect(kids()).toHaveLength(2);
    pipeline.renderFrame(scene);
    expect(sprite1?.destroyed).toBe(true);
    const [sprite2, label2] = [...kids()];
    expect(sprite2).not.toBe(sprite1);
    expect(label2).toBe(label1);
    expect(label2?.destroyed).toBe(false);
    expect(label2?.parent).not.toBeNull();
    for (let i = 0; i < 20; i++) pipeline.renderFrame(scene);
    expect(kids()).toHaveLength(2);
    expect(kids()[1]).toBe(label1);
  });

  it("destroys pooled labels when the owning Graphics is destroyed", () => {
    pipeline.renderFrame(scene);
    const label = kids()[1];
    skipDraw = true; // next frame returns the label to the pool, draws nothing
    pipeline.renderFrame(scene);
    expect(kids()).toHaveLength(0);
    expect(label?.destroyed).toBe(false);
    (
      pipeline as unknown as {
        _gmlDrawGraphics: Map<number, { destroy(): void }>;
      }
    )._gmlDrawGraphics
      .get(eid)
      ?.destroy();
    expect(label?.destroyed).toBe(true);
  });
});

describe("RenderPipeline draw_sprite texture paths", () => {
  it("loads frame 0 of a multi-frame sprite instead of the literal frame_{n} template", async () => {
    const loader = vi.fn(() => Promise.resolve(Texture.WHITE));
    const pipeline = new RenderPipeline({ textureLoader: loader });
    await pipeline.init();
    (
      pipeline as unknown as { _resolveTextureForDraw(path: string): unknown }
    )._resolveTextureForDraw("./assets/sprites/spr_a/frame_{n}.png");
    await Promise.resolve();
    expect(loader).toHaveBeenCalledWith("./assets/sprites/spr_a/frame_0.png");
    expect(loader).not.toHaveBeenCalledWith(
      "./assets/sprites/spr_a/frame_{n}.png",
    );
  });
});

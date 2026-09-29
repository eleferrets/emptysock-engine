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

  const kids = (): Kid[] =>
    (
      pipeline as unknown as {
        _gmlDrawGraphics: Map<number, { children: Kid[] }>;
      }
    )._gmlDrawGraphics.get(eid)?.children ?? [];

  beforeEach(async () => {
    registerGmlBehavior("leaky", {
      onDraw: (_e, ctx) => {
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

  it("destroys the previous frame's discarded children instead of dropping them", () => {
    pipeline.renderFrame(scene);
    const first = [...kids()];
    expect(first.length).toBe(2);
    pipeline.renderFrame(scene);
    for (const k of first) {
      expect(k.destroyed).toBe(true);
      expect(k.parent).toBeNull();
    }
    expect(kids()).toHaveLength(2);
  });
});

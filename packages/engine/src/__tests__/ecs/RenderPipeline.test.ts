import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as PixiJS from "pixi.js";
import { Texture } from "pixi.js";

// Same mocking strategy as ../RenderPipeline.test.ts (v1): stub
// autoDetectRenderer so init() never needs a real GPU/canvas, while every
// other pixi.js export (Container, Sprite, Texture, ...) stays real.
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

const { RenderPipeline } = await import("../../ecs/systems/RenderPipeline.js");
const { Scene } = await import("../../ecs/Scene.js");
const { Transform } = await import("../../ecs/components/Transform.js");
const { Sprite } = await import("../../ecs/components/Sprite.js");

function makeTestTexture(): Texture {
  return Texture.WHITE;
}

describe("ECS RenderPipeline (ENGINE_DESIGN.md §4 step 7 / §12.3)", () => {
  let pipeline: InstanceType<typeof RenderPipeline>;
  let scene: InstanceType<typeof Scene>;

  beforeEach(async () => {
    pipeline = new RenderPipeline({
      textureLoader: vi.fn(() => Promise.resolve(makeTestTexture())),
    });
    await pipeline.init();
    scene = new Scene();
  });

  it("ignores entities missing Transform or Sprite", () => {
    const entity = scene.spawn();
    entity.add(Sprite);
    pipeline.syncEntities(scene);
    expect(pipeline.layers.getEntityLayer(entity.eid)).toBeNull();
  });

  it("places a Transform+Sprite entity on its configured layer and depth", () => {
    const entity = scene.spawn();
    entity.add(Transform, { x: 10, y: 20 });
    entity.add(Sprite, { layer: "foreground", depth: 5 });

    pipeline.syncEntities(scene);

    expect(pipeline.layers.getEntityLayer(entity.eid)).toBe("foreground");
    expect(pipeline.layers.getEntityDepth(entity.eid)).toBe(5);
  });

  it("keeps sprite transform in sync across frames, via scene.each's raw arrays", () => {
    const entity = scene.spawn();
    const transform = entity.add(Transform, { x: 0, y: 0 });
    entity.add(Sprite);

    pipeline.syncEntities(scene);
    transform.x = 42;
    transform.y = 7;
    pipeline.syncEntities(scene);

    const sprite = (
      pipeline as unknown as {
        _tracking: Map<
          unknown,
          { sprites: Map<number, { x: number; y: number }> }
        >;
      }
    )._tracking
      .get(scene)
      ?.sprites.get(entity.eid);
    expect(sprite?.x).toBe(42);
    expect(sprite?.y).toBe(7);
  });

  it("removes tracking once the entity is destroyed", () => {
    const entity = scene.spawn();
    entity.add(Transform);
    entity.add(Sprite);
    pipeline.syncEntities(scene);
    expect(pipeline.layers.getEntityLayer(entity.eid)).toBe("default");

    scene.destroy(entity);
    pipeline.syncEntities(scene);

    expect(pipeline.layers.getEntityLayer(entity.eid)).toBeNull();
  });

  it("Sprite's texturePath field round-trips through add/get like any other field", () => {
    const entity = scene.spawn();
    entity.add(Transform);
    const sprite = entity.add(Sprite, { texturePath: "hero.png" });
    expect(sprite.texturePath).toBe("hero.png");
    expect(entity.get(Sprite)?.texturePath).toBe("hero.png");
  });

  it("renders an overlay scene's sprites into a container separate from the main scene's, with no eid aliasing", () => {
    const main = new Scene();
    const overlay = new Scene();

    // Both worlds hand out entity ids independently, so `mainEntity.eid` and
    // `overlayEntity.eid` may well be numerically equal (bitECS's versioned
    // ids happen to agree here since both are each world's first spawn) —
    // exactly the collision this test exists to rule out.
    const mainEntity = main.spawn();
    mainEntity.add(Transform, { x: 1, y: 1 });
    mainEntity.add(Sprite, { texturePath: "main.png" });

    const overlayEntity = overlay.spawn();
    overlayEntity.add(Transform, { x: 2, y: 2 });
    overlayEntity.add(Sprite, { texturePath: "hud.png" });

    // Confirm the premise: two fresh worlds' first spawn really do report
    // the same id, so the assertions below are actually exercising the
    // cross-scene scoping and not just two different numbers.
    expect(overlayEntity.eid).toBe(mainEntity.eid);

    pipeline.renderFrame(main, [overlay]);

    const internals = pipeline as unknown as {
      _tracking: Map<unknown, { sprites: Map<number, { x: number }> }>;
    };
    expect(internals._tracking.get(main)?.sprites.get(mainEntity.eid)?.x).toBe(
      1,
    );
    expect(
      internals._tracking.get(overlay)?.sprites.get(overlayEntity.eid)?.x,
    ).toBe(2);
  });

  it("releases an overlay's tracking once it stops being passed to renderFrame", () => {
    const main = new Scene();
    const overlay = new Scene();
    overlay.spawn().add(Transform);
    overlay.spawn().add(Sprite);

    pipeline.renderFrame(main, [overlay]);
    const internals = pipeline as unknown as {
      _tracking: Map<unknown, unknown>;
      _overlayContainers: Map<unknown, unknown>;
    };
    expect(internals._tracking.has(overlay)).toBe(true);

    pipeline.renderFrame(main, []); // overlay no longer active
    expect(internals._tracking.has(overlay)).toBe(false);
    expect(internals._overlayContainers.has(overlay)).toBe(false);
  });

  it("Bug 2 regression: swapping the main scene disposes the old scene's sprites, not aliases them", () => {
    const sceneA = new Scene();
    const sceneB = new Scene();

    const entityA = sceneA.spawn();
    entityA.add(Transform, { x: 1, y: 1 });
    entityA.add(Sprite, { texturePath: "a.png" });

    const entityB = sceneB.spawn();
    entityB.add(Transform, { x: 9, y: 9 });
    entityB.add(Sprite, { texturePath: "b.png" });

    // Two fresh worlds' first spawn share the same eid — the exact
    // aliasing case this regression test exists to rule out.
    expect(entityB.eid).toBe(entityA.eid);

    pipeline.renderFrame(sceneA);
    const internals = pipeline as unknown as {
      _tracking: Map<
        unknown,
        {
          sprites: Map<
            number,
            {
              x: number;
              texturePath?: string;
              destroyed: boolean;
              parent: unknown;
            }
          >;
        }
      >;
    };
    const spriteA = internals._tracking.get(sceneA)?.sprites.get(entityA.eid);
    expect(spriteA?.x).toBe(1);

    // Swap the main scene (as `Game.unloadScene()`/`loadScene()` would).
    pipeline.renderFrame(sceneB);

    // Scene A's tracking (and its sprite) must be gone entirely, not merged
    // into or overwritten by scene B's same-numbered entity.
    expect(internals._tracking.has(sceneA)).toBe(false);
    expect(spriteA?.destroyed).toBe(true);

    const spriteB = internals._tracking.get(sceneB)?.sprites.get(entityB.eid);
    expect(spriteB?.x).toBe(9);

    // No orphaned scene-A sprite left in the display tree.
    expect(spriteA?.parent).toBeNull();
  });
});

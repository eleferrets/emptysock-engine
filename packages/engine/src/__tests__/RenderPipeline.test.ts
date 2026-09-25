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

const { RenderPipeline } = await import("../systems/RenderPipeline.js");
const { Scene } = await import("../Scene.js");
const { Transform } = await import("../components/Transform.js");
const { Sprite } = await import("../components/Sprite.js");

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

  /** Read the real PixiJS sprite `RenderPipeline` is tracking for `eid` on `scene`, if any. */
  function trackedSprite(
    eid: number,
  ): { parent: PixiJS.Container | null; zIndex: number } | undefined {
    return (
      pipeline as unknown as {
        _tracking: Map<
          unknown,
          {
            sprites: Map<
              number,
              { parent: PixiJS.Container | null; zIndex: number }
            >;
          }
        >;
      }
    )._tracking
      .get(scene)
      ?.sprites.get(eid);
  }

  it("ignores entities missing Transform or Sprite", () => {
    const entity = scene.spawn();
    entity.add(Sprite);
    pipeline.syncEntities(scene);
    expect(trackedSprite(entity.eid)).toBeUndefined();
  });

  it("places a Transform+Sprite entity on its configured layer and depth", () => {
    const entity = scene.spawn();
    entity.add(Transform, { x: 10, y: 20 });
    entity.add(Sprite, { layer: "foreground", depth: 5 });

    pipeline.syncEntities(scene);

    // Real, observable placement: the sprite is parented somewhere under
    // the stage (one container per named layer, per RenderSystem's
    // getLayerContainer) and carries the configured zIndex — not
    // LayerSystem's removed per-entity bookkeeping, which had zero real
    // readers (see ecs/systems/RenderPipeline.ts's "On PixiJS's native
    // Render Layers" doc comment for the full audit).
    const sprite = trackedSprite(entity.eid);
    expect(sprite?.parent).not.toBeNull();
    expect(pipeline.stage.children).toContain(sprite?.parent);
    expect(sprite?.zIndex).toBe(5);
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
    expect(trackedSprite(entity.eid)).toBeDefined();

    scene.destroy(entity);
    pipeline.syncEntities(scene);

    expect(trackedSprite(entity.eid)).toBeUndefined();
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

describe("ECS RenderPipeline transition overlay (RELEASE_PASS.md Track 6)", () => {
  let pipeline: InstanceType<typeof RenderPipeline>;

  beforeEach(async () => {
    pipeline = new RenderPipeline({
      textureLoader: vi.fn(() => Promise.resolve(makeTestTexture())),
    });
    await pipeline.init();
  });

  it("does nothing when no transition is active", async () => {
    const { PostProcessSystem } =
      await import("../systems/PostProcessSystem.js");
    const post = new PostProcessSystem();
    expect(() => pipeline.renderTransitionOverlay(post)).not.toThrow();
  });

  it("draws a fade overlay without throwing while a transition is active", async () => {
    const { PostProcessSystem } =
      await import("../systems/PostProcessSystem.js");
    const post = new PostProcessSystem();
    post.beginTransition("fade", 0x000000);
    post.transitionProgress = 0.25;
    expect(post.transitionActive).toBe(true);
    expect(() => pipeline.renderTransitionOverlay(post)).not.toThrow();
  });

  it("draws wipe and slide overlays without throwing", async () => {
    const { PostProcessSystem } =
      await import("../systems/PostProcessSystem.js");
    const post = new PostProcessSystem();
    post.beginTransition("wipe", 0xffffff);
    post.transitionProgress = 0.5;
    expect(() => pipeline.renderTransitionOverlay(post)).not.toThrow();

    post.beginTransition("slide", 0x111111);
    post.transitionProgress = 0.75;
    expect(() => pipeline.renderTransitionOverlay(post)).not.toThrow();
  });

  it("hides the overlay once the transition ends", async () => {
    const { PostProcessSystem } =
      await import("../systems/PostProcessSystem.js");
    const post = new PostProcessSystem();
    post.beginTransition("fade", 0x000000);
    post.transitionProgress = 0.5;
    pipeline.renderTransitionOverlay(post);
    post.endTransition();
    expect(post.transitionActive).toBe(false);
    expect(() => pipeline.renderTransitionOverlay(post)).not.toThrow();
  });

  it("renderFrame() paints the transition overlay automatically once a PostProcessSystem is attached", async () => {
    const { PostProcessSystem } =
      await import("../systems/PostProcessSystem.js");
    const post = new PostProcessSystem();
    post.beginTransition("fade", 0x000000);
    post.transitionProgress = 0.5;
    pipeline.attachPostProcess(post);

    const scene = new Scene();
    expect(() => pipeline.renderFrame(scene)).not.toThrow();
  });
});

describe("RenderPipeline — multi-frame Sprite animation", () => {
  it("resolves the {n}-templated texturePath against currentFrame and reloads on advance", async () => {
    const loaded: string[] = [];
    const pipeline = new RenderPipeline({
      textureLoader: vi.fn((path: string) => {
        loaded.push(path);
        const tex = new (Texture as unknown as new () => PixiJS.Texture)();
        (tex as unknown as { __path: string }).__path = path;
        return Promise.resolve(tex);
      }),
    });
    await pipeline.init();
    const scene = new Scene();

    const entity = scene.spawn();
    entity.add(Transform);
    const sprite = entity.add(Sprite, {
      texturePath: "./assets/sprites/foo/frame_{n}.png",
      frameCount: 3,
      currentFrame: 0,
    });

    pipeline.syncEntities(scene);
    await Promise.resolve();
    await Promise.resolve();

    const pixiSprite = (
      pipeline as unknown as {
        _tracking: Map<
          unknown,
          {
            sprites: Map<number, { texture: { __path?: string } }>;
          }
        >;
      }
    )._tracking
      .get(scene)
      ?.sprites.get(entity.eid);
    expect(pixiSprite?.texture.__path).toBe("./assets/sprites/foo/frame_0.png");

    sprite.currentFrame = 2;
    pipeline.syncEntities(scene);
    await Promise.resolve();
    await Promise.resolve();

    expect(pixiSprite?.texture.__path).toBe("./assets/sprites/foo/frame_2.png");
    expect(loaded).toEqual([
      "./assets/sprites/foo/frame_0.png",
      "./assets/sprites/foo/frame_2.png",
    ]);
  });
});

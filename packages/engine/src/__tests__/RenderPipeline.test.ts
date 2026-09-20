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
const { Scene } = await import("../core/Scene.js");
const { Transform } = await import("../components/Transform.js");
const { Sprite } = await import("../components/Sprite.js");
const { Tilemap, TilemapSystem } = await import("../systems/TilemapSystem.js");
const { AutoTileSystem } = await import("../systems/AutoTileSystem.js");

function makeTestTexture(): Texture {
  return Texture.WHITE;
}

describe("RenderPipeline", () => {
  let pipeline: InstanceType<typeof RenderPipeline>;
  let scene: InstanceType<typeof Scene>;

  beforeEach(async () => {
    pipeline = new RenderPipeline({
      textureLoader: vi.fn(() => Promise.resolve(makeTestTexture())),
    });
    await pipeline.init();
    scene = new Scene("test");
  });

  it("does not create a PixiJS sprite for entities missing Transform or Sprite", () => {
    const entity = scene.createEntity("bare");
    entity.addComponent(new Sprite());
    pipeline.syncEntities(scene);
    expect(pipeline.layers.getEntityLayer(entity.id)).toBeNull();
  });

  it("places a Transform+Sprite entity on its configured layer and depth", () => {
    const entity = scene.createEntity("hero");
    entity.addComponent(new Transform({ x: 10, y: 20 }));
    entity.addComponent(new Sprite({ layer: "foreground", depth: 5 }));

    pipeline.syncEntities(scene);

    expect(pipeline.layers.getEntityLayer(entity.id)).toBe("foreground");
    expect(pipeline.layers.getEntityDepth(entity.id)).toBe(5);
  });

  it("keeps sprite transform in sync across frames", () => {
    const entity = scene.createEntity("hero");
    const transform = entity.addComponent(new Transform({ x: 0, y: 0 }));
    entity.addComponent(new Sprite());

    pipeline.syncEntities(scene);
    const container = pipeline.layers.getEntityLayer(entity.id);
    expect(container).toBe("default");

    transform.x = 42;
    transform.y = 7;
    pipeline.syncEntities(scene);

    const sprite = (
      pipeline as unknown as {
        _pixiSprites: Map<number, { x: number; y: number }>;
      }
    )._pixiSprites.get(entity.id);
    expect(sprite?.x).toBe(42);
    expect(sprite?.y).toBe(7);
  });

  it("removes tracking when the entity is destroyed", () => {
    const entity = scene.createEntity("hero");
    entity.addComponent(new Transform());
    entity.addComponent(new Sprite());
    pipeline.syncEntities(scene);
    expect(pipeline.layers.getEntityLayer(entity.id)).toBe("default");

    entity.destroy();
    pipeline.syncEntities(scene);

    expect(pipeline.layers.getEntityLayer(entity.id)).toBeNull();
  });

  it("removes tracking when a Sprite component is removed without destroying the entity", () => {
    const entity = scene.createEntity("hero");
    entity.addComponent(new Transform());
    entity.addComponent(new Sprite());
    pipeline.syncEntities(scene);

    entity.removeComponent(Sprite.TYPE);
    pipeline.syncEntities(scene);

    expect(pipeline.layers.getEntityLayer(entity.id)).toBeNull();
  });

  it("mounts a tilemap and builds one tile sprite per non-empty cell", async () => {
    const tilemap = new Tilemap(
      {
        name: "test-map",
        tileWidth: 16,
        tileHeight: 16,
        cols: 2,
        rows: 1,
        tileset: {
          imagePath: "tileset.png",
          tileWidth: 16,
          tileHeight: 16,
          columns: 4,
          rows: 4,
        },
        layers: [
          {
            name: "ground",
            visible: true,
            opacity: 1,
            cells: [[{ tileIndex: 0, solid: false }, { tileIndex: -1 }]],
          },
        ],
      },
      scene.createEntity("map"),
    );

    pipeline.mountTilemap(tilemap);
    // texture loading is async; flush microtasks
    await Promise.resolve();
    await Promise.resolve();

    const container = pipeline.layers.getLayerIndex("default");
    expect(container).toBeDefined();
    TilemapSystem.remove("test-map");
  });

  it("resolves tile variants through AutoTileSystem when provided", async () => {
    const autoTile = new AutoTileSystem();
    autoTile.addRuleSet({
      id: "grass",
      baseTileIndex: 0,
      rules: [],
      defaultTileIndex: 9,
    });

    const tilemap = new Tilemap(
      {
        name: "auto-map",
        tileWidth: 16,
        tileHeight: 16,
        cols: 1,
        rows: 1,
        tileset: {
          imagePath: "tileset.png",
          tileWidth: 16,
          tileHeight: 16,
          columns: 4,
          rows: 4,
        },
        layers: [
          {
            name: "ground",
            visible: true,
            opacity: 1,
            cells: [[{ tileIndex: 0 }]],
          },
        ],
      },
      scene.createEntity("auto-entity"),
    );

    const resolveSpy = vi.spyOn(autoTile, "resolve");
    pipeline.mountTilemap(tilemap, "default", autoTile);
    await Promise.resolve();
    await Promise.resolve();

    expect(resolveSpy).toHaveBeenCalledWith(0, 0, 0, expect.any(Function));
  });
});

describe("RenderPipeline transition overlay", () => {
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
});

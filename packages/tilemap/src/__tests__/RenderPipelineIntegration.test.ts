/**
 * Integration test between `@emptysock/engine`'s RenderPipeline and this
 * package's Tilemap/TilemapSystem/AutoTileSystem.
 *
 * Moved out of `packages/engine/src/__tests__/RenderPipeline.test.ts` when
 * Tilemap/NavMeshSystem became their own module package (`@emptysock/tilemap`,
 * CLAUDE.md §13.1) — RenderPipeline itself stays in the engine and only
 * depends on the structural `TileLayerSource` shape (see
 * `RenderPipeline.ts`'s `TileLayerSource` doc comment), so this test — which
 * needs both a real `RenderPipeline` and a real `Tilemap` — lives here, in
 * the package that already depends on both, rather than in the engine.
 * `AutoTileSystem` itself moved here too (RELEASE_PASS.md Track 2) — it's
 * imported from `../AutoTileSystem.js` now, not `@emptysock/engine`, which
 * only knows its structural `AutoTileResolver` shape.
 */
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

const { RenderPipeline } = await import("@emptysock/engine");
const { Tilemap, TilemapSystem } = await import("../TilemapSystem.js");
const { AutoTileSystem } = await import("../AutoTileSystem.js");

function makeTestTexture(): Texture {
  return Texture.WHITE;
}

describe("RenderPipeline + Tilemap", () => {
  let pipeline: InstanceType<typeof RenderPipeline>;

  beforeEach(async () => {
    pipeline = new RenderPipeline({
      textureLoader: vi.fn(() => Promise.resolve(makeTestTexture())),
    });
    await pipeline.init();
  });

  it("mounts a tilemap and builds one tile sprite per non-empty cell", async () => {
    const tilemap = new Tilemap({
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
    });

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

    const tilemap = new Tilemap({
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
    });

    const resolveSpy = vi.spyOn(autoTile, "resolve");
    pipeline.mountTilemap(tilemap, "default", autoTile);
    await Promise.resolve();
    await Promise.resolve();

    expect(resolveSpy).toHaveBeenCalledWith(0, 0, 0, expect.any(Function));
  });
});

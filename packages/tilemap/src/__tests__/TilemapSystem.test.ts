import { describe, it, expect, beforeEach } from "vitest";
import { TilemapSystem } from "../TilemapSystem.js";
import { Game, defineScene, Transform } from "@emptysock/engine";
import type { TilemapData } from "../TilemapSystem.js";

function makeData(solid?: boolean): TilemapData {
  return {
    name: "TestMap",
    tileWidth: 16,
    tileHeight: 16,
    cols: 3,
    rows: 2,
    tileset: {
      imagePath: "tiles.png",
      tileWidth: 16,
      tileHeight: 16,
      columns: 8,
      rows: 4,
    },
    layers: [
      {
        name: "Ground",
        visible: true,
        opacity: 1,
        cells: [
          [
            { tileIndex: 0 },
            { tileIndex: 1, solid: solid ?? false },
            { tileIndex: 0 },
          ],
          [{ tileIndex: 0 }, { tileIndex: 0 }, { tileIndex: 2 }],
        ],
      },
    ],
  };
}

beforeEach(() => {
  TilemapSystem.remove("TestMap");
});

describe("TilemapSystem", () => {
  it("registers and retrieves a map", () => {
    const map = TilemapSystem.register(makeData());
    expect(TilemapSystem.get("TestMap")).toBe(map);
  });

  it("computes correct width and height", () => {
    const map = TilemapSystem.register(makeData());
    expect(map.width).toBe(48);
    expect(map.height).toBe(32);
  });

  it("getLayer returns correct layer", () => {
    const map = TilemapSystem.register(makeData());
    const layer = map.getLayer("Ground");
    expect(layer).toBeDefined();
    expect(layer?.cells[0]?.[0]?.tileIndex).toBe(0);
  });

  it("asGrid marks solid cells as false", () => {
    const map = TilemapSystem.register(makeData(true));
    const grid = map.asGrid();
    expect(grid[0]?.[1]).toBe(false);
    expect(grid[0]?.[0]).toBe(true);
  });

  it("has no entity until loadInto spawns one", () => {
    const map = TilemapSystem.register(makeData());
    expect(map.entity).toBeNull();
  });

  it("loadInto spawns a real, live entity with a Transform, bound to the map", async () => {
    TilemapSystem.register(makeData());
    const game = new Game();
    const { scene } = await game.loadScene(defineScene({}), {
      manageLifecycle: false,
    });
    const map = TilemapSystem.loadInto(scene, "TestMap");
    expect(map.entity).not.toBeNull();
    expect(map.entity?.isAlive).toBe(true);
    expect(map.entity?.has(Transform)).toBe(true);
    await game.unloadScene();
  });
});

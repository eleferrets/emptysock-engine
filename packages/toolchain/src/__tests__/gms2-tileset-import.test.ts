import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  convertGms2Tileset,
  buildTilesetAsset,
  buildRoomTilemapModule,
} from "../gms2-tileset-import.js";
import type { RoomData } from "../gms2-room-import.js";
import { importGMS2Project } from "../gms2-import.js";

// A real, minimal, valid 1x1 PNG (also used by gms2-import.test.ts's own
// sprite/background fixtures) — enough for `fs.copyFile`/`fs.access` to
// exercise real file I/O without needing a real tile-sheet image.
const TINY_PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108020000009077" +
    "53de0000000a49444154789c6300010000050001a5f645400000000049454e" +
    "44ae426082",
  "hex",
);

async function writeTilesetFixture(
  projectRoot: string,
  tilesetName: string,
  spriteName: string,
  opts: {
    tileWidth: number;
    tileHeight: number;
    tilehsep?: number;
    tilevsep?: number;
    tilexoff?: number;
    tileyoff?: number;
    spriteWidth: number;
    spriteHeight: number;
  },
): Promise<void> {
  const tilehsep = opts.tilehsep ?? 0;
  const tilevsep = opts.tilevsep ?? 0;
  const tilexoff = opts.tilexoff ?? 0;
  const tileyoff = opts.tileyoff ?? 0;

  const spriteDir = path.join(projectRoot, "sprites", spriteName);
  await fs.mkdir(spriteDir, { recursive: true });
  await fs.writeFile(
    path.join(spriteDir, `${spriteName}-frame0.png`),
    TINY_PNG,
  );
  await fs.writeFile(
    path.join(spriteDir, `${spriteName}.yy`),
    `{
      "name":"${spriteName}",
      "width":${opts.spriteWidth},
      "height":${opts.spriteHeight},
      "frames":[{"name":"${spriteName}-frame0",},],
    }`,
    "utf-8",
  );

  const tilesetDir = path.join(projectRoot, "tilesets", tilesetName);
  await fs.mkdir(tilesetDir, { recursive: true });
  await fs.writeFile(
    path.join(tilesetDir, `${tilesetName}.yy`),
    `{
      "$GMTileSet":"v1",
      "name":"${tilesetName}",
      "resourceType":"GMTileSet",
      "spriteId":{"name":"${spriteName}","path":"sprites/${spriteName}/${spriteName}.yy",},
      "tileWidth":${opts.tileWidth},
      "tileHeight":${opts.tileHeight},
      "tilehsep":${tilehsep},
      "tilevsep":${tilevsep},
      "tilexoff":${tilexoff},
      "tileyoff":${tileyoff},
      "tile_count":1,
      "out_columns":999,
    }`,
    "utf-8",
  );
}

describe("convertGms2Tileset — real GMTileset .yy format", () => {
  let dir: string;

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-tileset-"));
  });

  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("derives columns/rows from the referenced sprite's real pixel size, not out_columns", async () => {
    // 128x64 sheet, 16x16 tiles, no separation/offset -> 8 columns, 4 rows.
    // out_columns is deliberately set to a nonsense value (999) to prove
    // it's not what column count comes from.
    await writeTilesetFixture(dir, "ts_basic", "spr_ts_basic", {
      tileWidth: 16,
      tileHeight: 16,
      spriteWidth: 128,
      spriteHeight: 64,
    });

    const tileset = await convertGms2Tileset(
      path.join(dir, "tilesets", "ts_basic"),
      dir,
    );

    expect(tileset.name).toBe("ts_basic");
    expect(tileset.tileWidth).toBe(16);
    expect(tileset.tileHeight).toBe(16);
    expect(tileset.columns).toBe(8);
    expect(tileset.rows).toBe(4);
    expect(tileset.spacing).toBe(0);
    expect(tileset.margin).toBe(0);
    expect(tileset.imagePath).toContain("spr_ts_basic");
    expect(tileset.asymmetryWarning).toBeUndefined();
  });

  it("accounts for real separation (tilehsep/tilevsep) and offset (tilexoff/tileyoff) when computing columns/rows", async () => {
    // Sheet is 100x100. Tiles are 10x10, offset by 2px from the edge, with
    // 2px separation between each tile:
    //   columns = floor((100 - 2 + 2) / (10 + 2)) = floor(100/12) = 8
    //   rows    = floor((100 - 2 + 2) / (10 + 2)) = 8
    await writeTilesetFixture(dir, "ts_sep", "spr_ts_sep", {
      tileWidth: 10,
      tileHeight: 10,
      tilehsep: 2,
      tilevsep: 2,
      tilexoff: 2,
      tileyoff: 2,
      spriteWidth: 100,
      spriteHeight: 100,
    });

    const tileset = await convertGms2Tileset(
      path.join(dir, "tilesets", "ts_sep"),
      dir,
    );

    expect(tileset.columns).toBe(8);
    expect(tileset.rows).toBe(8);
    expect(tileset.spacing).toBe(2);
    expect(tileset.margin).toBe(2);
    expect(tileset.asymmetryWarning).toBeUndefined();
  });

  it("reports an honest asymmetry warning when hsep/vsep or xoff/yoff differ (TilesetConfig has only one spacing/margin value each)", async () => {
    await writeTilesetFixture(dir, "ts_asym", "spr_ts_asym", {
      tileWidth: 10,
      tileHeight: 10,
      tilehsep: 4,
      tilevsep: 1,
      tilexoff: 0,
      tileyoff: 3,
      spriteWidth: 100,
      spriteHeight: 100,
    });

    const tileset = await convertGms2Tileset(
      path.join(dir, "tilesets", "ts_asym"),
      dir,
    );

    expect(tileset.asymmetryWarning).toBeDefined();
    expect(tileset.asymmetryWarning).toContain("ts_asym");
    expect(tileset.asymmetryWarning).toContain("tilehsep=4");
    expect(tileset.asymmetryWarning).toContain("tilevsep=1");
  });

  it("throws a clear error when the tileset's .yy has no real spriteId reference", async () => {
    const tilesetDir = path.join(dir, "tilesets", "ts_no_sprite");
    await fs.mkdir(tilesetDir, { recursive: true });
    await fs.writeFile(
      path.join(tilesetDir, "ts_no_sprite.yy"),
      `{"name":"ts_no_sprite","spriteId":null,"tileWidth":16,"tileHeight":16,}`,
      "utf-8",
    );

    await expect(convertGms2Tileset(tilesetDir, dir)).rejects.toThrow(
      /no real "spriteId"/,
    );
  });
});

describe("buildTilesetAsset — real TilesetConfig descriptor + image copy", () => {
  it("copies the real source image and emits a real TilesetConfig-shaped module", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-tileset-asset-"));
    const out = await fs.mkdtemp(
      path.join(os.tmpdir(), "gms2-tileset-asset-out-"),
    );
    try {
      await writeTilesetFixture(dir, "ts_export", "spr_ts_export", {
        tileWidth: 32,
        tileHeight: 32,
        spriteWidth: 64,
        spriteHeight: 32,
      });

      const { content, tileset } = await buildTilesetAsset(
        "ts_export",
        dir,
        out,
      );

      expect(tileset.columns).toBe(2);
      expect(tileset.rows).toBe(1);
      expect(content).toContain("export const TsExportTileset");
      expect(content).toContain("tileWidth: 32");
      expect(content).toContain("tileHeight: 32");
      expect(content).toContain("columns: 2");
      expect(content).toContain("rows: 1");
      expect(content).toContain("./assets/tilesets/ts_export/sheet.png");

      const copiedBytes = await fs.readFile(
        path.join(out, "assets", "tilesets", "ts_export", "sheet.png"),
      );
      expect(copiedBytes.equals(TINY_PNG)).toBe(true);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
      await fs.rm(out, { recursive: true, force: true });
    }
  });
});

describe("buildRoomTilemapModule — per-tile fidelity, not a sample", () => {
  it("places every single non-empty tile at its exact [row][col], leaves everything else -1, across a full grid", () => {
    // A deliberately irregular placement pattern (not a simple diagonal or
    // fill) across a 4x3 grid (cols x rows), so a row/col swap, off-by-one,
    // or partial-copy bug would be caught rather than accidentally masked.
    const room: RoomData = {
      name: "rm_grid",
      width: 64, // 4 cols * 16
      height: 48, // 3 rows * 16
      layers: [
        {
          name: "Ground",
          type: "GMRTileLayer",
          instances: [],
          tiles: [
            { tilesetId: "ts_grid", x: 0, y: 0, tileIndex: 5 },
            { tilesetId: "ts_grid", x: 3, y: 0, tileIndex: 6 },
            { tilesetId: "ts_grid", x: 1, y: 1, tileIndex: 7 },
            { tilesetId: "ts_grid", x: 2, y: 2, tileIndex: 8 },
            { tilesetId: "ts_grid", x: 0, y: 2, tileIndex: 9 },
            // Wrong tileset — must be dropped, not placed.
            { tilesetId: "ts_other", x: 1, y: 0, tileIndex: 99 },
            // Out of bounds — must be dropped, not placed or throw.
            { tilesetId: "ts_grid", x: 99, y: 0, tileIndex: 42 },
          ],
        },
      ],
    };

    const tileset = {
      name: "ts_grid",
      imagePath: "/dev/null",
      imageWidth: 16,
      imageHeight: 16,
      tileWidth: 16,
      tileHeight: 16,
      columns: 1,
      rows: 1,
      spacing: 0,
      margin: 0,
    };

    const result = buildRoomTilemapModule("rm_grid", room, "ts_grid", tileset);

    expect(result.tilesPlaced).toBe(5);
    expect(result.tilesDropped).toBe(2);

    // Cross-check every single cell of the generated 3-row x 4-col grid
    // against the expected layout — not a sample.
    const expectedGrid: number[][] = [
      [5, -1, -1, 6],
      [-1, 7, -1, -1],
      [9, -1, 8, -1],
    ];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const expected = expectedGrid[row]?.[col];
        const cellSource = `{ tileIndex: ${expected} }`;
        expect(result.content).toContain(cellSource);
      }
    }

    // Structural shape: exactly 3 rows, each with exactly 4 cells, inside
    // one generated layer block.
    const rowMatches = result.content.match(
      /\[\{ tileIndex: -?\d+ \}(?:, \{ tileIndex: -?\d+ \}){3}\]/g,
    );
    expect(rowMatches).toHaveLength(3);
  });
});

describe("importGMS2Project — end to end: tileset resource -> asset file, room tile layer -> tilemap data", () => {
  let dir: string;
  let out: string;

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-tileset-e2e-"));
    out = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-tileset-e2e-out-"));

    await fs.writeFile(
      path.join(dir, "project.yyp"),
      `{
        "%Name":"Tileset E2E Test",
        "resources":[
          {"id":{"name":"ts_e2e","path":"tilesets/ts_e2e/ts_e2e.yy",},},
          {"id":{"name":"rm_e2e","path":"rooms/rm_e2e/rm_e2e.yy",},},
        ],
      }`,
      "utf-8",
    );

    await writeTilesetFixture(dir, "ts_e2e", "spr_ts_e2e", {
      tileWidth: 16,
      tileHeight: 16,
      spriteWidth: 32,
      spriteHeight: 16,
    });

    const roomDir = path.join(dir, "rooms", "rm_e2e");
    await fs.mkdir(roomDir, { recursive: true });
    // 2x2 tile room (32x32), one tile layer referencing ts_e2e, with tiles
    // at every one of the 4 cells so full coverage is verifiable.
    await fs.writeFile(
      path.join(roomDir, "rm_e2e.yy"),
      `{
        "name":"rm_e2e",
        "roomSettings":{"Width":32,"Height":32,},
        "layers":[
          {"name":"Ground","resourceType":"GMRTileLayer","tiles":{
            "tilesetId":{"name":"ts_e2e",},
            "TileData":[[1,2],[3,4],],
          },},
        ],
      }`,
      "utf-8",
    );

    await importGMS2Project(path.join(dir, "project.yyp"), out, {
      verbose: false,
    });
  });

  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
    await fs.rm(out, { recursive: true, force: true });
  });

  it("converts the tileset resource into a real asset file with its image copied", async () => {
    const content = await fs.readFile(
      path.join(out, "assets", "ts_e2e.tileset.ts"),
      "utf-8",
    );
    expect(content).toContain("export const TsE2eTileset");
    expect(content).toContain("tileWidth: 16");
    expect(content).toContain("columns: 2");
    expect(content).toContain("rows: 1");

    await fs.access(
      path.join(out, "assets", "tilesets", "ts_e2e", "sheet.png"),
    );
  });

  it("converts the room's tile layer into a real, fully-populated TilemapData module", async () => {
    const content = await fs.readFile(
      path.join(out, "rooms", "rm_e2e.tilemap.ts"),
      "utf-8",
    );
    expect(content).toContain(
      'import { TsE2eTileset } from "../assets/ts_e2e.tileset.js";',
    );
    expect(content).toContain("export const RmE2eTilemap");
    expect(content).toContain("tileset: TsE2eTileset");
    expect(content).toContain("cols: 2");
    expect(content).toContain("rows: 2");

    // Every one of the 4 placed tiles, at its exact position — cross-checked
    // individually, not sampled.
    expect(content).toContain("[{ tileIndex: 1 }, { tileIndex: 2 }]");
    expect(content).toContain("[{ tileIndex: 3 }, { tileIndex: 4 }]");
  });

  it("reports the tileset as converted in the migration report, with no leftover 'not converted'/manual tile warnings", async () => {
    const report = await fs.readFile(
      path.join(out, "migration-report.md"),
      "utf-8",
    );
    expect(report).toContain("| Tilesets (converted) | 1 |");
    expect(report).not.toContain("parsed but not converted");
    expect(report).not.toContain("Tileset: `ts_e2e`");
  });

  it("emits no warnings — a room whose one tile layer fully converts against its one referenced tileset is a clean success, not a partial one", async () => {
    const result = await importGMS2Project(path.join(dir, "project.yyp"), out, {
      verbose: false,
    });
    expect(result.warnings).toEqual([]);
  });
});

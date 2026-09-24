import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  convertGms2Tileset,
  buildTilesetAsset,
  buildRoomTilemapModule,
} from "../gms2-tileset-import.js";
import { convertGms2Room, type RoomData } from "../gms2-room-import.js";
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

describe("convertGms2Room — real GMRTileLayer format (TileSerialiseData, not TileData)", () => {
  it("parses a real room's flat TileSerialiseData grid, with tilesetId read from the layer itself (not nested under tiles), and strips GameMaker's real flip/mirror/rotate flag bits to recover the real tile index", async () => {
    const dir = await fs.mkdtemp(
      path.join(os.tmpdir(), "gms2-room-serialise-"),
    );
    try {
      const roomDir = path.join(dir, "rooms", "rm_serial");
      await fs.mkdir(roomDir, { recursive: true });
      // Real GameMaker room .yy shape (confirmed against a real, full
      // GameMaker project's exported rooms): tilesetId is a sibling of
      // "tiles" on the layer object itself, and "tiles" holds a flat,
      // row-major TileSerialiseData array plus SerialiseWidth/Height — never
      // a nested TileData 2D array. A 4x3 grid (cols x rows):
      //   raw value 0                -> empty
      //   raw value 0x80000000       -> GameMaker's real "no tile" sentinel
      //                                 (flip flag set, masked index 0) —
      //                                 also empty
      //   raw value 5                -> real tile index 5, unflagged
      //   raw value 0x80000005       -> real tile index 5, WITH the flip
      //                                 flag set — masked index must still
      //                                 resolve to 5, not 0 and not the
      //                                 unmasked huge number
      await fs.writeFile(
        path.join(roomDir, "rm_serial.yy"),
        `{
          "name":"rm_serial",
          "roomSettings":{"Width":32,"Height":24,},
          "layers":[
            {"tilesetId":{"name":"ts_real",},"x":0,"y":0,"tiles":{
              "SerialiseWidth":4,"SerialiseHeight":3,
              "TileSerialiseData":[
                0,5,0,2147483648,
                2147483648,0,0,0,
                0,0,2147483653,0,
              ],
            },"visible":true,"name":"Ground","resourceType":"GMRTileLayer",},
          ],
        }`,
        "utf-8",
      );

      const room: RoomData = await convertGms2Room(
        path.join(roomDir, "rm_serial.yy"),
      );

      const layer = room.layers[0];
      if (layer === undefined) throw new Error("expected one layer");
      expect(layer.tiles).toEqual([
        { tilesetId: "ts_real", x: 1, y: 0, tileIndex: 5 },
        { tilesetId: "ts_real", x: 2, y: 2, tileIndex: 5 },
      ]);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("still supports the old nested tiles.tilesetId + TileData shape (this module's own pre-existing synthetic fixtures)", async () => {
    const dir = await fs.mkdtemp(
      path.join(os.tmpdir(), "gms2-room-legacy-tiledata-"),
    );
    try {
      const roomDir = path.join(dir, "rooms", "rm_legacy");
      await fs.mkdir(roomDir, { recursive: true });
      await fs.writeFile(
        path.join(roomDir, "rm_legacy.yy"),
        `{
          "name":"rm_legacy",
          "roomSettings":{"Width":32,"Height":16,},
          "layers":[
            {"name":"Ground","resourceType":"GMRTileLayer","tiles":{
              "tilesetId":{"name":"ts_legacy",},
              "TileData":[[1,0],[0,2],],
            },},
          ],
        }`,
        "utf-8",
      );

      const room: RoomData = await convertGms2Room(
        path.join(roomDir, "rm_legacy.yy"),
      );

      const layer = room.layers[0];
      if (layer === undefined) throw new Error("expected one layer");
      expect(layer.tiles).toEqual([
        { tilesetId: "ts_legacy", x: 0, y: 0, tileIndex: 1 },
        { tilesetId: "ts_legacy", x: 1, y: 1, tileIndex: 2 },
      ]);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});

describe("importGMS2Project — a room referencing multiple distinct tilesets", () => {
  it("converts each distinct tileset into its own sibling TilemapData module, instead of bailing out", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-tileset-multi-"));
    const out = await fs.mkdtemp(
      path.join(os.tmpdir(), "gms2-tileset-multi-out-"),
    );
    try {
      await fs.writeFile(
        path.join(dir, "project.yyp"),
        `{
          "%Name":"Multi Tileset Test",
          "resources":[
            {"id":{"name":"ts_ground","path":"tilesets/ts_ground/ts_ground.yy",},},
            {"id":{"name":"ts_props","path":"tilesets/ts_props/ts_props.yy",},},
            {"id":{"name":"rm_multi","path":"rooms/rm_multi/rm_multi.yy",},},
          ],
        }`,
        "utf-8",
      );

      // Two independent 16x16-tile tilesets, each on its own 32x16 sheet
      // (2 columns x 1 row).
      await writeTilesetFixture(dir, "ts_ground", "spr_ts_ground", {
        tileWidth: 16,
        tileHeight: 16,
        spriteWidth: 32,
        spriteHeight: 16,
      });
      await writeTilesetFixture(dir, "ts_props", "spr_ts_props", {
        tileWidth: 16,
        tileHeight: 16,
        spriteWidth: 32,
        spriteHeight: 16,
      });

      const roomDir = path.join(dir, "rooms", "rm_multi");
      await fs.mkdir(roomDir, { recursive: true });
      // 2x2-tile room (32x32) with two tile layers: a Ground layer against
      // ts_ground and a Props layer against ts_props — a real, common
      // authoring pattern (separate layers per tileset).
      await fs.writeFile(
        path.join(roomDir, "rm_multi.yy"),
        `{
          "name":"rm_multi",
          "roomSettings":{"Width":32,"Height":32,},
          "layers":[
            {"name":"Ground","resourceType":"GMRTileLayer","tiles":{
              "tilesetId":{"name":"ts_ground",},
              "TileData":[[1,2],[0,0],],
            },},
            {"name":"Props","resourceType":"GMRTileLayer","tiles":{
              "tilesetId":{"name":"ts_props",},
              "TileData":[[0,0],[3,4],],
            },},
          ],
        }`,
        "utf-8",
      );

      const result = await importGMS2Project(
        path.join(dir, "project.yyp"),
        out,
        { verbose: false },
      );

      // No warnings — both tilesets converted, all tiles found a home.
      expect(result.warnings).toEqual([]);

      // Each tileset gets its own sibling tilemap module, not a bail note.
      const groundContent = await fs.readFile(
        path.join(out, "rooms", "rm_multi.ts_ground.tilemap.ts"),
        "utf-8",
      );
      expect(groundContent).toContain(
        'import { TsGroundTileset } from "../assets/ts_ground.tileset.js";',
      );
      expect(groundContent).toContain("export const RmMultiTilemap");
      expect(groundContent).toContain("[{ tileIndex: 1 }, { tileIndex: 2 }]");
      expect(groundContent).toContain("[{ tileIndex: -1 }, { tileIndex: -1 }]");

      const propsContent = await fs.readFile(
        path.join(out, "rooms", "rm_multi.ts_props.tilemap.ts"),
        "utf-8",
      );
      expect(propsContent).toContain(
        'import { TsPropsTileset } from "../assets/ts_props.tileset.js";',
      );
      expect(propsContent).toContain("[{ tileIndex: 3 }, { tileIndex: 4 }]");

      // Cross-referenced against the real source TileData: the Ground
      // layer's grid was [[1,2],[0,0]] (row-major, 0 = empty) and the Props
      // layer's was [[0,0],[3,4]] — every non-zero cell from both layers
      // must land in its own tileset's module, and nowhere else.
      expect(groundContent).not.toContain("tileIndex: 3");
      expect(groundContent).not.toContain("tileIndex: 4");
      expect(propsContent).not.toContain("tileIndex: 1 }");
      expect(propsContent).not.toContain("tileIndex: 2 }");

      const report = await fs.readFile(
        path.join(out, "migration-report.md"),
        "utf-8",
      );
      expect(report).toContain("| Tilesets (converted) | 2 |");
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
      await fs.rm(out, { recursive: true, force: true });
    }
  });

  it("still reports a real per-tileset note when one of several tilesets a room references never converted", async () => {
    const dir = await fs.mkdtemp(
      path.join(os.tmpdir(), "gms2-tileset-multi-fail-"),
    );
    const out = await fs.mkdtemp(
      path.join(os.tmpdir(), "gms2-tileset-multi-fail-out-"),
    );
    try {
      await fs.writeFile(
        path.join(dir, "project.yyp"),
        `{
          "%Name":"Multi Tileset Partial Test",
          "resources":[
            {"id":{"name":"ts_ok","path":"tilesets/ts_ok/ts_ok.yy",},},
            {"id":{"name":"rm_partial","path":"rooms/rm_partial/rm_partial.yy",},},
          ],
        }`,
        "utf-8",
      );

      await writeTilesetFixture(dir, "ts_ok", "spr_ts_ok", {
        tileWidth: 16,
        tileHeight: 16,
        spriteWidth: 16,
        spriteHeight: 16,
      });

      const roomDir = path.join(dir, "rooms", "rm_partial");
      await fs.mkdir(roomDir, { recursive: true });
      // "ts_missing" is never registered as a project resource at all, so
      // it never converts — only "ts_ok" does.
      await fs.writeFile(
        path.join(roomDir, "rm_partial.yy"),
        `{
          "name":"rm_partial",
          "roomSettings":{"Width":16,"Height":16,},
          "layers":[
            {"name":"Ground","resourceType":"GMRTileLayer","tiles":{
              "tilesetId":{"name":"ts_ok",},
              "TileData":[[1],],
            },},
            {"name":"Missing","resourceType":"GMRTileLayer","tiles":{
              "tilesetId":{"name":"ts_missing",},
              "TileData":[[5],],
            },},
          ],
        }`,
        "utf-8",
      );

      const result = await importGMS2Project(
        path.join(dir, "project.yyp"),
        out,
        { verbose: false },
      );

      expect(result.warnings).toEqual([
        expect.stringContaining(
          'Room "rm_partial": 1 tile(s) reference tileset "ts_missing", which was not converted',
        ) as string,
      ]);

      // The tileset that did convert still gets a real generated module.
      const okContent = await fs.readFile(
        path.join(out, "rooms", "rm_partial.ts_ok.tilemap.ts"),
        "utf-8",
      );
      expect(okContent).toContain("tileIndex: 1");
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
      await fs.rm(out, { recursive: true, force: true });
    }
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

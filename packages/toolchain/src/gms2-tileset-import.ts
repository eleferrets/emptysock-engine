import { promises as fs } from "node:fs";
import path from "node:path";
import { parseGmsJson } from "./gms2-parse.js";
import { convertGms2Sprite } from "./gms2-sprite-import.js";
import type { RoomData } from "./gms2-room-import.js";

/**
 * Converted GMS2 tileset, shaped to map directly onto `@emptysock/tilemap`'s
 * real `TilesetConfig` (`packages/tilemap/src/TilemapSystem.ts`):
 * `{ imagePath, tileWidth, tileHeight, columns, rows, spacing?, margin? }`.
 */
export interface TilesetAsset {
  name: string;
  /** Absolute path to the source tile-sheet image on disk. */
  imagePath: string;
  imageWidth: number;
  imageHeight: number;
  tileWidth: number;
  tileHeight: number;
  columns: number;
  rows: number;
  spacing: number;
  margin: number;
  /**
   * Set when the real `.yy`'s horizontal/vertical separation (`tilehsep`/
   * `tilevsep`) or offset (`tilexoff`/`tileyoff`) values are not equal —
   * `TilesetConfig` only has one `spacing`/`margin` field each (no separate
   * x/y), so an asymmetric tileset loses that distinction. Reported honestly
   * rather than silently averaged/dropped; the caller should surface this as
   * a warning.
   */
  asymmetryWarning?: string;
}

/**
 * Real GMS2 `GMTileset` `.yy` fields (confirmed against a real fixture, see
 * `NPC-Studio/yy-typings`'s `data/tileset/test.yy` and `src/tileset.rs`):
 *
 * ```json
 * {
 *   "$GMTileSet": "v1",
 *   "name": "tile_collision_info",
 *   "resourceType": "GMTileSet",
 *   "spriteId": { "name": "spr_collision_tile_info", "path": "sprites/..." },
 *   "tileWidth": 8,
 *   "tileHeight": 8,
 *   "tilehsep": 0,
 *   "tilevsep": 0,
 *   "tilexoff": 0,
 *   "tileyoff": 0,
 *   "tile_count": 7,
 *   "out_columns": 3
 * }
 * ```
 *
 * Notably: a GMTileset resource has **no image of its own** — its tile
 * sheet is a real `Sprite` resource referenced by `spriteId`, and the
 * tileset's own `.yy` only carries the slicing metadata (tile size,
 * separation, offset). `out_columns` is GameMaker's own internal runtime
 * texture-page packing width, not the source sheet's natural column count,
 * so it is deliberately not used here — the real column/row count is
 * derived from the referenced sprite's actual pixel dimensions (see
 * `convertGms2Tileset`).
 */
interface YyTileset {
  name?: string;
  spriteId?: { name?: string };
  tileWidth?: number;
  tileHeight?: number;
  tilehsep?: number;
  tilevsep?: number;
  tilexoff?: number;
  tileyoff?: number;
  [key: string]: unknown;
}

function isYyTileset(val: unknown): val is YyTileset {
  return typeof val === "object" && val !== null;
}

/**
 * Convert a GMS2 tileset resource directory (containing a `.yy` file) into a
 * `TilesetAsset` — reads the tileset's own slicing metadata, then follows
 * its `spriteId` reference to the real sprite resource that actually holds
 * the tile-sheet image (via `convertGms2Sprite`, the same converter
 * `convertGms2RoomBackgrounds` already reuses for its own sprite lookups),
 * and derives columns/rows from that sprite's real pixel dimensions.
 *
 * Throws a descriptive Error if the directory, `.yy` file, referenced
 * sprite, or its image cannot be found/read — matching every other resource
 * converter's honest-failure shape in this importer.
 */
export async function convertGms2Tileset(
  tilesetYyDir: string,
  projectRoot: string,
): Promise<TilesetAsset> {
  let entries: string[];
  try {
    entries = await fs.readdir(tilesetYyDir);
  } catch (err) {
    throw new Error(
      `convertGms2Tileset: cannot read directory "${tilesetYyDir}": ${String(err)}`,
    );
  }

  const yyFile = entries.find((e) => e.endsWith(".yy"));
  if (yyFile === undefined) {
    throw new Error(
      `convertGms2Tileset: no .yy file found in "${tilesetYyDir}"`,
    );
  }

  const yyPath = path.join(tilesetYyDir, yyFile);
  let raw: string;
  try {
    raw = await fs.readFile(yyPath, "utf-8");
  } catch (err) {
    throw new Error(
      `convertGms2Tileset: cannot read "${yyPath}": ${String(err)}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = parseGmsJson(raw);
  } catch (err) {
    throw new Error(
      `convertGms2Tileset: invalid JSON in "${yyPath}": ${String(err)}`,
    );
  }

  if (!isYyTileset(parsed)) {
    throw new Error(
      `convertGms2Tileset: unexpected .yy structure in "${yyPath}"`,
    );
  }

  const name =
    typeof parsed.name === "string" ? parsed.name : path.basename(tilesetYyDir);

  const spriteName = parsed.spriteId?.name;
  if (typeof spriteName !== "string" || spriteName.length === 0) {
    throw new Error(
      `convertGms2Tileset: tileset "${name}" has no real "spriteId" reference in "${yyPath}" — a GMTileset with no source sprite has no image to convert.`,
    );
  }

  const spriteDir = path.join(projectRoot, "sprites", spriteName);
  const sprite = await convertGms2Sprite(spriteDir);
  const firstFrame = sprite.frames[0];
  if (firstFrame === undefined) {
    throw new Error(
      `convertGms2Tileset: tileset "${name}"'s source sprite "${spriteName}" has no frames.`,
    );
  }

  const tileWidth =
    typeof parsed.tileWidth === "number" ? parsed.tileWidth : 16;
  const tileHeight =
    typeof parsed.tileHeight === "number" ? parsed.tileHeight : 16;
  const tilehsep = typeof parsed.tilehsep === "number" ? parsed.tilehsep : 0;
  const tilevsep = typeof parsed.tilevsep === "number" ? parsed.tilevsep : 0;
  const tilexoff = typeof parsed.tilexoff === "number" ? parsed.tilexoff : 0;
  const tileyoff = typeof parsed.tileyoff === "number" ? parsed.tileyoff : 0;

  const imageWidth = sprite.width > 0 ? sprite.width : tileWidth;
  const imageHeight = sprite.height > 0 ? sprite.height : tileHeight;

  // Real column/row count is derived from the sheet's actual pixel size,
  // not read from any field in the .yy (see this file's header comment on
  // why `out_columns` is not it): each tile occupies tileWidth/tileHeight
  // pixels, offset from the sheet's edge by tilexoff/tileyoff and separated
  // from its neighbours by tilehsep/tilevsep.
  const columns = Math.max(
    1,
    Math.floor((imageWidth - tilexoff + tilehsep) / (tileWidth + tilehsep)),
  );
  const rows = Math.max(
    1,
    Math.floor((imageHeight - tileyoff + tilevsep) / (tileHeight + tilevsep)),
  );

  let asymmetryWarning: string | undefined;
  if (tilehsep !== tilevsep || tilexoff !== tileyoff) {
    asymmetryWarning = `Tileset "${name}" has asymmetric separation/offset (tilehsep=${tilehsep}, tilevsep=${tilevsep}, tilexoff=${tilexoff}, tileyoff=${tileyoff}) — @emptysock/tilemap's TilesetConfig has only one spacing/margin value each, so the horizontal values (tilehsep/tilexoff) were used and the vertical ones were dropped.`;
  }

  return {
    name,
    imagePath: firstFrame.imagePath,
    imageWidth,
    imageHeight,
    tileWidth,
    tileHeight,
    columns,
    rows,
    spacing: tilehsep,
    margin: tilexoff,
    ...(asymmetryWarning !== undefined ? { asymmetryWarning } : {}),
  };
}

function toPascalCase(name: string): string {
  return name
    .split(/[_\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/**
 * Build a real TypeScript `TilesetConfig`-shaped descriptor from a converted
 * GMS2 tileset, plus copy its source tile-sheet image into
 * `<outDir>/assets/tilesets/<name>/` (mirroring `buildSpriteAsset`'s
 * image-copying convention in `gms2-codegen.ts`). Colocated with the
 * conversion logic here, matching `buildSoundAsset`/`buildFontAsset`'s own
 * "colocated with its converter" precedent.
 */
export async function buildTilesetAsset(
  name: string,
  projectRoot: string,
  outDir: string,
): Promise<{ content: string; tileset: TilesetAsset }> {
  const tilesetDir = path.join(projectRoot, "tilesets", name);
  const tileset = await convertGms2Tileset(tilesetDir, projectRoot);

  const assetDir = path.join(outDir, "assets", "tilesets", name);
  await fs.mkdir(assetDir, { recursive: true });
  const destName = "sheet.png";
  await fs.copyFile(tileset.imagePath, path.join(assetDir, destName));

  const relPath = `./assets/tilesets/${name}/${destName}`;
  const pascal = toPascalCase(name);

  const content = `// Auto-generated from GMS2 tileset: ${name}
// Use with @emptysock/tilemap's TilemapSystem, as a room's TilemapData.tileset:
//   TilemapSystem.register({ name: "...", tileWidth: ${tileset.tileWidth}, tileHeight: ${tileset.tileHeight}, cols, rows, tileset: ${pascal}Tileset, layers: [...] });
export const ${pascal}Tileset = {
  imagePath: ${JSON.stringify(relPath)},
  tileWidth: ${tileset.tileWidth},
  tileHeight: ${tileset.tileHeight},
  columns: ${tileset.columns},
  rows: ${tileset.rows},
  spacing: ${tileset.spacing},
  margin: ${tileset.margin},
} as const;
`;

  return { content, tileset };
}

/** Result of converting one room's tile layers into a `TilemapData` module. */
export interface RoomTilemapResult {
  /** The generated `<room>.tilemap.ts` module source. */
  content: string;
  /** How many placed tiles (across every included layer) made it into the generated grid. */
  tilesPlaced: number;
  /**
   * Placed tiles that referenced a *different* tileset than the one this
   * call converted, or fell outside the computed grid bounds — dropped, not
   * fabricated. A room can legally have tile layers on several different
   * tilesets; `TilemapData` (the real `@emptysock/tilemap` shape) only
   * carries one `tileset` per map, so only layers referencing `tilesetName`
   * are included here. The caller reports this count honestly rather than
   * silently losing it.
   */
  tilesDropped: number;
}

/**
 * Build a real `<room>.tilemap.ts` module from a room's previously-parsed
 * `RoomLayer.tiles` data (`convertGms2Room`'s `parseTiles()`) plus one
 * already-converted tileset — the two previously-honest-but-unused halves
 * CLAUDE.md's GMS2 tileset entry used to describe as "parsed but not
 * converted". Only tile layers whose `TileEntry.tilesetId` matches
 * `tilesetName` are included (a room's other tile layers, if any reference a
 * *different* tileset, are reported separately by the caller via
 * `tilesDropped`/its own migration-report note — `TilemapData` has exactly
 * one `tileset` field, so one room only ever gets one generated tilemap
 * module per converted tileset).
 *
 * The generated grid's `cols`/`rows` are derived from the room's own
 * `width`/`height` divided by the tileset's `tileWidth`/`tileHeight`
 * (rounded up) — real GMS2 room tile-layer data is authored against the
 * room's own pixel dimensions, so this is the room's actual tile grid size,
 * not a guess. Every cell defaults to `{ tileIndex: -1 }` (empty, matching
 * `TileCell`'s own documented sentinel) and is overwritten at `[row][col]`
 * for each placed tile this layer/tileset combination actually has — a
 * sparse `TileEntry` list becoming a dense, fully-shaped `cells` grid is
 * exactly what `@emptysock/tilemap`'s `TilemapLayer.cells: TileCell[][]`
 * requires.
 */
export function buildRoomTilemapModule(
  roomName: string,
  room: RoomData,
  tilesetName: string,
  tileset: TilesetAsset,
): RoomTilemapResult {
  const cols = Math.max(1, Math.ceil(room.width / tileset.tileWidth));
  const rows = Math.max(1, Math.ceil(room.height / tileset.tileHeight));

  const tileLayers = room.layers.filter((layer) => layer.tiles.length > 0);

  let tilesPlaced = 0;
  let tilesDropped = 0;

  const layers = tileLayers.map((layer) => {
    const cells: { tileIndex: number }[][] = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ tileIndex: -1 })),
    );
    for (const tile of layer.tiles) {
      if (tile.tilesetId !== tilesetName) {
        tilesDropped++;
        continue;
      }
      if (tile.x < 0 || tile.x >= cols || tile.y < 0 || tile.y >= rows) {
        tilesDropped++;
        continue;
      }
      const row = cells[tile.y];
      if (row === undefined) {
        tilesDropped++;
        continue;
      }
      row[tile.x] = { tileIndex: tile.tileIndex };
      tilesPlaced++;
    }
    return { name: layer.name, cells, visible: true, opacity: 1 };
  });

  const pascalRoom = toPascalCase(roomName);
  const pascalTileset = toPascalCase(tilesetName);

  const layersSource = layers
    .map((layer) => {
      const rowsSource = layer.cells
        .map(
          (row) =>
            `      [${row.map((cell) => `{ tileIndex: ${cell.tileIndex} }`).join(", ")}]`,
        )
        .join(",\n");
      return `    {
      name: ${JSON.stringify(layer.name)},
      visible: true,
      opacity: 1,
      cells: [
${rowsSource}
      ],
    }`;
    })
    .join(",\n");

  const content = `// Auto-generated from GMS2 room: ${roomName}'s tile layer(s), tileset: ${tilesetName}
// Use with @emptysock/tilemap's TilemapSystem:
//   TilemapSystem.register(${pascalRoom}Tilemap);
//   TilemapSystem.loadInto(scene, ${JSON.stringify(roomName)});
import { ${pascalTileset}Tileset } from "../assets/${tilesetName}.tileset.js";

export const ${pascalRoom}Tilemap = {
  name: ${JSON.stringify(roomName)},
  tileWidth: ${tileset.tileWidth},
  tileHeight: ${tileset.tileHeight},
  cols: ${cols},
  rows: ${rows},
  tileset: ${pascalTileset}Tileset,
  layers: [
${layersSource}
  ],
} as const;
`;

  return { content, tilesPlaced, tilesDropped };
}

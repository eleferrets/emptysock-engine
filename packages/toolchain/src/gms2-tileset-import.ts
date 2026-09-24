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
 * `NPC-Studio/yy-typings`'s `data/tileset/test.yy` and `src/tileset.rs`, and
 * against a real full GameMaker export's own tileset resources):
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
 *   "out_columns": 3,
 *   "out_tilehborder": 2,
 *   "out_tilevborder": 2
 * }
 * ```
 *
 * A GMTileset resource's own `spriteId` references a real `Sprite`
 * resource that (in GameMaker's IDE) holds the source tile-sheet image —
 * but GameMaker's own IDE *also* bakes a ready-to-use tile-sheet atlas
 * directly into the tileset resource's own directory, alongside its `.yy`,
 * named `output_tileset.png`. This is confirmed against a real, full
 * GameMaker project export: every real `GMTileset` resource directory
 * examined there had this file, laid out on a real, verifiable grid
 * derived entirely from this same `.yy`'s own fields — `out_columns` is
 * the atlas's real column count (`rows = ceil(tile_count / out_columns)`),
 * and `output_tileset.png`'s real pixel dimensions confirm it exactly:
 * `(tileWidth + 2*out_tilehborder) * out_columns` wide,
 * `(tileHeight + 2*out_tilevborder) * rows` tall — e.g. a real tileset with
 * `tileWidth: 8`, `out_tilehborder: 2`, `out_columns: 8` produces a
 * `96`-pixel-wide PNG (`(8 + 2*2) * 8 = 96`), confirmed byte-for-byte
 * against the real file. `out_tilehborder`/`out_tilevborder` is a per-tile
 * padding/bleed border baked around *every* tile cell in this atlas (not a
 * single sheet-wide margin, and not inter-tile spacing in the usual
 * "gap with nothing in it" sense) — each cell occupies
 * `tileWidth + 2*out_tilehborder` pixels, with the real tile's pixels
 * centred inside it. Working through `@emptysock/tilemap`'s own tile
 * sampling formula (`RenderPipeline.mountTilemap()`:
 * `sx = margin + col * (tileWidth + spacing)`) against this layout shows
 * `margin = out_tilehborder` and `spacing = 2 * out_tilehborder` reproduce
 * the real per-cell pixel offsets exactly (col 0 starts at `out_tilehborder`
 * — the first cell's own border; col 1 starts at
 * `out_tilehborder + (tileWidth + 2*out_tilehborder)`, i.e. two adjacent
 * cells' borders back-to-back) — so this is the correct source for
 * `TilesetConfig.margin`/`.spacing` once `output_tileset.png` is the
 * chosen image, genuinely distinct from the sprite-pixel-dimension-derived
 * `tilehsep`/`tilevsep`/`tilexoff`/`tileyoff` formula the fallback path
 * below still uses (those describe the *separate, un-atlased* source
 * sprite referenced by `spriteId`, a different image entirely).
 *
 * `out_columns` was previously documented here as "GameMaker's own internal
 * runtime texture-page packing width, not the source sheet's natural
 * column count" — that was true of the *referenced sprite's* packing, but
 * is not the right description of what it means for `output_tileset.png`
 * specifically: for this baked atlas, `out_columns` is exactly its real
 * column count, confirmed against real pixel dimensions above.
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
  out_columns?: number;
  out_tilehborder?: number;
  out_tilevborder?: number;
  tile_count?: number;
  [key: string]: unknown;
}

function isYyTileset(val: unknown): val is YyTileset {
  return typeof val === "object" && val !== null;
}

/**
 * Convert a GMS2 tileset resource directory (containing a `.yy` file) into a
 * `TilesetAsset`.
 *
 * Preferred path: the tileset's own baked `output_tileset.png`, sitting
 * directly in this same directory alongside the `.yy` — GameMaker's IDE
 * writes this file for every real tileset resource (see this file's
 * `YyTileset` doc comment for the real, byte-verified grid derivation). This
 * is strictly more direct than chasing `spriteId` to a second resource
 * directory: no second resource to locate, no formula derived from an
 * unrelated image's pixel dimensions, and the resulting `columns`/`rows`
 * come straight from `.yy` fields (`out_columns`, `tile_count`) rather than
 * being inferred.
 *
 * Fallback path: when `output_tileset.png` is missing (an older GameMaker
 * workflow, a manually-assembled project, or a resource that was never
 * re-baked after editing), this follows the tileset's `spriteId` reference
 * to the real sprite resource that holds a tile-sheet image instead (via
 * `convertGms2Sprite`, the same converter `convertGms2RoomBackgrounds`
 * already reuses for its own sprite lookups) and derives columns/rows from
 * that sprite's real pixel dimensions, exactly as this function used to
 * unconditionally do.
 *
 * Throws a descriptive Error only when *neither* path has anything to
 * convert — no baked atlas and no resolvable `spriteId`/sprite directory —
 * matching every other resource converter's honest-failure shape in this
 * importer.
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

  const tileWidth =
    typeof parsed.tileWidth === "number" ? parsed.tileWidth : 16;
  const tileHeight =
    typeof parsed.tileHeight === "number" ? parsed.tileHeight : 16;

  const bakedImagePath = path.join(tilesetYyDir, "output_tileset.png");
  const hasBakedAtlas = await fileExists(bakedImagePath);

  if (hasBakedAtlas) {
    return buildFromBakedAtlas(
      name,
      parsed,
      bakedImagePath,
      tileWidth,
      tileHeight,
    );
  }

  // Fallback: no baked atlas in this tileset's own directory — chase
  // spriteId to a separate Sprite resource, exactly as this function used
  // to unconditionally do (see this function's own doc comment).
  const spriteName = parsed.spriteId?.name;
  if (typeof spriteName !== "string" || spriteName.length === 0) {
    throw new Error(
      `convertGms2Tileset: tileset "${name}" has no baked "output_tileset.png" in "${tilesetYyDir}" and no real "spriteId" reference in "${yyPath}" — a GMTileset with neither has no image to convert.`,
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

  const tilehsep = typeof parsed.tilehsep === "number" ? parsed.tilehsep : 0;
  const tilevsep = typeof parsed.tilevsep === "number" ? parsed.tilevsep : 0;
  const tilexoff = typeof parsed.tilexoff === "number" ? parsed.tilexoff : 0;
  const tileyoff = typeof parsed.tileyoff === "number" ? parsed.tileyoff : 0;

  const imageWidth = sprite.width > 0 ? sprite.width : tileWidth;
  const imageHeight = sprite.height > 0 ? sprite.height : tileHeight;

  // Real column/row count is derived from the sheet's actual pixel size,
  // not read from any field in the .yy: each tile occupies
  // tileWidth/tileHeight pixels, offset from the sheet's edge by
  // tilexoff/tileyoff and separated from its neighbours by
  // tilehsep/tilevsep. (`out_columns` describes the baked-atlas layout the
  // preferred path above already used when available — see this file's
  // `YyTileset` doc comment — not this separately-referenced sprite's
  // layout, so it is deliberately not used here.)
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

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Build a `TilesetAsset` straight from a tileset's own baked
 * `output_tileset.png`, using only the `.yy`'s own fields — no second
 * resource, no pixel-dimension-derived column/row count. See this file's
 * `YyTileset` doc comment for the real, byte-verified grid this atlas
 * follows and the `margin`/`spacing` derivation from
 * `out_tilehborder`/`out_tilevborder`.
 */
function buildFromBakedAtlas(
  name: string,
  parsed: YyTileset,
  imagePath: string,
  tileWidth: number,
  tileHeight: number,
): TilesetAsset {
  const columns =
    typeof parsed.out_columns === "number" && parsed.out_columns > 0
      ? parsed.out_columns
      : 1;
  const tileCount =
    typeof parsed.tile_count === "number" && parsed.tile_count > 0
      ? parsed.tile_count
      : columns;
  const rows = Math.max(1, Math.ceil(tileCount / columns));

  const hborder =
    typeof parsed.out_tilehborder === "number" ? parsed.out_tilehborder : 0;
  const vborder =
    typeof parsed.out_tilevborder === "number" ? parsed.out_tilevborder : 0;

  // Each baked cell is tileWidth/tileHeight plus a border on every side;
  // @emptysock/tilemap's real sampling formula is
  // `sx = margin + col * (tileWidth + spacing)` (RenderPipeline.mountTilemap()),
  // which this atlas's real per-cell layout satisfies exactly when
  // margin = border (the first cell's own border) and
  // spacing = 2 * border (two adjacent cells' borders, back-to-back).
  const margin = hborder;
  const spacing = 2 * hborder;

  const imageWidth = (tileWidth + 2 * hborder) * columns;
  const imageHeight = (tileHeight + 2 * vborder) * rows;

  let asymmetryWarning: string | undefined;
  if (hborder !== vborder) {
    asymmetryWarning = `Tileset "${name}" has asymmetric baked border (out_tilehborder=${hborder}, out_tilevborder=${vborder}) — @emptysock/tilemap's TilesetConfig has only one spacing/margin value each, so the horizontal border was used and the vertical one was dropped.`;
  }

  return {
    name,
    imagePath,
    imageWidth,
    imageHeight,
    tileWidth,
    tileHeight,
    columns,
    rows,
    spacing,
    margin,
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
 * converted". Only tiles whose `TileEntry.tilesetId` matches `tilesetName`
 * are placed into the generated grid — every other placed tile (whether it
 * references a genuinely different tileset, or falls outside the room's
 * computed grid bounds) is counted in `tilesDropped`, not silently lost or
 * fabricated. `TilemapData` has exactly one `tileset` field, so this
 * function only ever produces one tileset's worth of tile data per call —
 * the caller (`importGMS2Project`, `gms2-import.ts`) is what calls this once
 * per distinct tileset a room's tile layers actually reference, emitting one
 * sibling `.tilemap.ts` module per tileset for a room that uses more than
 * one (see that call site's own doc comment for the real multi-tileset
 * file-naming scheme). A room's tile layers referencing a *different*
 * tileset than `tilesetName` here is therefore an entirely expected,
 * non-error case from this function's own point of view — those tiles are
 * simply this call's business, not this call's to place.
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

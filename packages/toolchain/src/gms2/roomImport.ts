import * as fs from "node:fs";
import * as path from "node:path";

// ── GMS2 .yy input shapes ─────────────────────────────────────────────────────

interface GMS2InstanceEntry {
  objectId: { name: string };
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
}

interface GMS2TileData {
  SerialiseWidth: number;
  SerialiseHeight: number;
  TileSerialiseData: number[];
}

interface GMS2Layer {
  resourceType: string;
  name: string;
  gridX?: number;
  gridY?: number;
  tiles?: GMS2TileData;
  instances?: GMS2InstanceEntry[];
}

interface GMS2RoomYY {
  name: string;
  roomSettings: { Width: number; Height: number };
  layers: GMS2Layer[];
}

// ── Engine-compatible output shapes ──────────────────────────────────────────

export interface TileLayer {
  id: string;
  name: string;
  visible: boolean;
  tiles: number[][];
}

export interface RoomEntity {
  name: string;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  tag: string;
}

export interface RoomAsset {
  name: string;
  width: number;
  height: number;
  tileSize: number;
  tileLayers: TileLayer[];
  entities: RoomEntity[];
}

// ── Validation helpers ────────────────────────────────────────────────────────

function assertString(val: unknown, field: string, src: string): string {
  if (typeof val !== "string") {
    throw new Error(`importGMS2Room: missing or invalid "${field}" in "${src}"`);
  }
  return val;
}

function assertNumber(val: unknown, field: string, src: string): number {
  if (typeof val !== "number") {
    throw new Error(`importGMS2Room: missing or invalid "${field}" in "${src}"`);
  }
  return val;
}

function parseYY(raw: string, yyPath: string): GMS2RoomYY {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`importGMS2Room: invalid JSON in "${yyPath}": ${String(err)}`);
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(`importGMS2Room: root must be an object in "${yyPath}"`);
  }
  const obj = parsed as Record<string, unknown>;

  const name = assertString(obj["name"], "name", yyPath);

  if (typeof obj["roomSettings"] !== "object" || obj["roomSettings"] === null) {
    throw new Error(`importGMS2Room: "roomSettings" missing in "${yyPath}"`);
  }
  const rs = obj["roomSettings"] as Record<string, unknown>;
  const width = assertNumber(rs["Width"], "roomSettings.Width", yyPath);
  const height = assertNumber(rs["Height"], "roomSettings.Height", yyPath);

  if (!Array.isArray(obj["layers"])) {
    throw new Error(`importGMS2Room: "layers" must be an array in "${yyPath}"`);
  }

  const layers = (obj["layers"] as unknown[]).map((l, i): GMS2Layer => {
    if (typeof l !== "object" || l === null) {
      throw new Error(`importGMS2Room: layers[${i}] is not an object in "${yyPath}"`);
    }
    const lo = l as Record<string, unknown>;
    const resourceType = assertString(lo["resourceType"], `layers[${i}].resourceType`, yyPath);
    const layerName = assertString(lo["name"], `layers[${i}].name`, yyPath);

    const gridX = typeof lo["gridX"] === "number" ? lo["gridX"] : 32;
    const gridY = typeof lo["gridY"] === "number" ? lo["gridY"] : 32;

    let tiles: GMS2TileData | undefined;
    if (typeof lo["tiles"] === "object" && lo["tiles"] !== null) {
      const t = lo["tiles"] as Record<string, unknown>;
      const sw = assertNumber(t["SerialiseWidth"], `layers[${i}].tiles.SerialiseWidth`, yyPath);
      const sh = assertNumber(t["SerialiseHeight"], `layers[${i}].tiles.SerialiseHeight`, yyPath);
      if (!Array.isArray(t["TileSerialiseData"])) {
        throw new Error(`importGMS2Room: layers[${i}].tiles.TileSerialiseData must be an array in "${yyPath}"`);
      }
      tiles = {
        SerialiseWidth: sw,
        SerialiseHeight: sh,
        TileSerialiseData: (t["TileSerialiseData"] as unknown[]).map((v, j) => {
          if (typeof v !== "number") {
            throw new Error(`importGMS2Room: layers[${i}].tiles.TileSerialiseData[${j}] is not a number in "${yyPath}"`);
          }
          return v;
        }),
      };
    }

    let instances: GMS2InstanceEntry[] | undefined;
    if (Array.isArray(lo["instances"])) {
      instances = (lo["instances"] as unknown[]).map((inst, j) => {
        if (typeof inst !== "object" || inst === null) {
          throw new Error(`importGMS2Room: layers[${i}].instances[${j}] is not an object in "${yyPath}"`);
        }
        const io = inst as Record<string, unknown>;
        if (typeof io["objectId"] !== "object" || io["objectId"] === null) {
          throw new Error(`importGMS2Room: layers[${i}].instances[${j}].objectId missing in "${yyPath}"`);
        }
        const oid = io["objectId"] as Record<string, unknown>;
        const objName = assertString(oid["name"], `layers[${i}].instances[${j}].objectId.name`, yyPath);
        return {
          objectId: { name: objName },
          x: typeof io["x"] === "number" ? io["x"] : 0,
          y: typeof io["y"] === "number" ? io["y"] : 0,
          scaleX: typeof io["scaleX"] === "number" ? io["scaleX"] : 1,
          scaleY: typeof io["scaleY"] === "number" ? io["scaleY"] : 1,
        };
      });
    }

    return { resourceType, name: layerName, gridX, gridY, tiles, instances };
  });

  return { name, roomSettings: { Width: width, Height: height }, layers };
}

// ── Tile reshaping ────────────────────────────────────────────────────────────

const TILE_INDEX_MASK = 0x7fffffff;

function reshapeTiles(tileData: GMS2TileData): number[][] {
  const { SerialiseWidth: cols, SerialiseHeight: rows, TileSerialiseData: flat } = tileData;
  const grid: number[][] = [];
  for (let row = 0; row < rows; row++) {
    const rowArr: number[] = [];
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      const raw = idx < flat.length ? flat[idx] : 0;
      rowArr.push((raw ?? 0) & TILE_INDEX_MASK);
    }
    grid.push(rowArr);
  }
  return grid;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse a GMS2 room `.yy` file and return a RoomAsset compatible with the
 * engine's TilemapEditor format.
 * Throws a descriptive Error on missing file, invalid JSON, or missing fields.
 */
export function importGMS2Room(yyPath: string): RoomAsset {
  let raw: string;
  try {
    raw = fs.readFileSync(yyPath, "utf-8");
  } catch (err) {
    throw new Error(`importGMS2Room: cannot read "${yyPath}": ${String(err)}`);
  }

  const yy = parseYY(raw, yyPath);

  const tileLayers: TileLayer[] = [];
  const entities: RoomEntity[] = [];

  // Derive a canonical tileSize from the first tile layer found
  let tileSize = 32;

  for (const layer of yy.layers) {
    if (layer.resourceType === "GMTileLayer" && layer.tiles !== undefined) {
      if (layer.gridX !== undefined) tileSize = layer.gridX;
      tileLayers.push({
        id: layer.name,
        name: layer.name,
        visible: true,
        tiles: reshapeTiles(layer.tiles),
      });
    } else if (layer.resourceType === "GMInstanceLayer" && layer.instances !== undefined) {
      for (const inst of layer.instances) {
        entities.push({
          name: inst.objectId.name,
          x: inst.x,
          y: inst.y,
          scaleX: inst.scaleX,
          scaleY: inst.scaleY,
          tag: inst.objectId.name,
        });
      }
    }
  }

  return {
    name: yy.name,
    width: yy.roomSettings.Width,
    height: yy.roomSettings.Height,
    tileSize,
    tileLayers,
    entities,
  };
}

/**
 * Walk a directory, find all `.yy` files, and import each as a RoomAsset.
 * Files that fail to parse are skipped with a warning written to stderr.
 */
export function importGMS2RoomDir(roomDir: string): RoomAsset[] {
  let entries: string[];
  try {
    entries = fs.readdirSync(roomDir);
  } catch (err) {
    throw new Error(`importGMS2RoomDir: cannot read directory "${roomDir}": ${String(err)}`);
  }

  const results: RoomAsset[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".yy")) continue;
    const yyPath = path.join(roomDir, entry);
    try {
      results.push(importGMS2Room(yyPath));
    } catch (err) {
      process.stderr.write(`importGMS2RoomDir: skipping "${yyPath}": ${String(err)}\n`);
    }
  }
  return results;
}

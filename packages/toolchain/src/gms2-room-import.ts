import { promises as fs } from "node:fs";

export interface TileEntry {
  tilesetId: string;
  x: number;
  y: number;
  tileIndex: number;
}

export interface InstanceEntry {
  objectName: string;
  x: number;
  y: number;
}

export interface RoomLayer {
  name: string;
  type: string;
  tiles: TileEntry[];
  instances: InstanceEntry[];
  /**
   * The referenced sprite's name, for a `GMRBackgroundLayer` that has a real
   * `spriteId` set (a tiled/parallax background image, as opposed to a plain
   * solid-colour compatibility layer with `spriteId: null`). There is no
   * import path for this today — `buildRoomSceneJSON` has nowhere to put a
   * background image reference in the current `SceneFile` shape — so this
   * field exists purely so the caller can warn that a real background image
   * was dropped, instead of silently losing it with no note anywhere.
   */
  backgroundSprite?: string;
}

export interface RoomData {
  name: string;
  width: number;
  height: number;
  layers: RoomLayer[];
}

// ── Internal shapes for the GMS2 room .yy JSON ──────────────────────────────

interface YyInstance {
  objectId?: { name?: string };
  x?: number;
  y?: number;
  [key: string]: unknown;
}

interface YyLayer {
  name?: string;
  layerType?: string;
  // Real GMS2 room .yy files identify layer kind via the resourceType field
  // (e.g. "GMRInstanceLayer", "GMRTileLayer", "GMRBackgroundLayer"), not a
  // "layerType" field — that field does not exist in the real format.
  resourceType?: string;
  tiles?: {
    TileData?: number[][];
    tilesetId?: { name?: string };
    [key: string]: unknown;
  };
  instances?: YyInstance[];
  [key: string]: unknown;
}

interface YyRoom {
  name?: string;
  roomSettings?: { Width?: number; Height?: number; [key: string]: unknown };
  layers?: YyLayer[];
  [key: string]: unknown;
}

function isYyRoom(val: unknown): val is YyRoom {
  return typeof val === "object" && val !== null;
}

function parseTiles(layer: YyLayer): TileEntry[] {
  const tiles = layer.tiles;
  if (tiles === undefined || typeof tiles !== "object") return [];

  const tilesetId =
    typeof tiles.tilesetId === "object" &&
    typeof (tiles.tilesetId as Record<string, unknown>)["name"] === "string"
      ? ((tiles.tilesetId as Record<string, unknown>)["name"] as string)
      : "";

  const tileData = Array.isArray(tiles["TileData"])
    ? (tiles["TileData"] as number[][])
    : [];

  const result: TileEntry[] = [];
  tileData.forEach((row, rowIdx) => {
    if (!Array.isArray(row)) return;
    row.forEach((tileIndex, colIdx) => {
      if (typeof tileIndex === "number" && tileIndex !== 0) {
        result.push({ tilesetId, x: colIdx, y: rowIdx, tileIndex });
      }
    });
  });
  return result;
}

function parseInstances(layer: YyLayer): InstanceEntry[] {
  const instances = layer.instances;
  if (!Array.isArray(instances)) return [];
  return instances.map((inst) => ({
    objectName:
      typeof inst.objectId === "object" &&
      typeof (inst.objectId as Record<string, unknown>)["name"] === "string"
        ? ((inst.objectId as Record<string, unknown>)["name"] as string)
        : "Unknown",
    x: typeof inst.x === "number" ? inst.x : 0,
    y: typeof inst.y === "number" ? inst.y : 0,
  }));
}

/**
 * Convert a GMS2 room .yy file path into a RoomData object.
 * Throws a descriptive Error on missing file, unreadable file, or invalid JSON.
 */
export async function convertGms2Room(roomYyPath: string): Promise<RoomData> {
  let raw: string;
  try {
    raw = await fs.readFile(roomYyPath, "utf-8");
  } catch (err) {
    throw new Error(
      `convertGms2Room: cannot read "${roomYyPath}": ${String(err)}`,
    );
  }

  let parsed: unknown;
  try {
    // Real GMS2 .yy files use trailing commas, which JSON.parse rejects.
    parsed = JSON.parse(raw.replace(/,(\s*[}\]])/g, "$1"));
  } catch (err) {
    throw new Error(
      `convertGms2Room: invalid JSON in "${roomYyPath}": ${String(err)}`,
    );
  }

  if (!isYyRoom(parsed)) {
    throw new Error(
      `convertGms2Room: unexpected .yy structure in "${roomYyPath}"`,
    );
  }

  const name = typeof parsed.name === "string" ? parsed.name : "Room";
  const settings = parsed.roomSettings ?? {};
  const width = typeof settings.Width === "number" ? settings.Width : 1024;
  const height = typeof settings.Height === "number" ? settings.Height : 768;

  const rawLayers = Array.isArray(parsed.layers) ? parsed.layers : [];
  const layers: RoomLayer[] = rawLayers.map((layer) => {
    const layerName = typeof layer.name === "string" ? layer.name : "Layer";
    const layerType =
      typeof layer.layerType === "string"
        ? layer.layerType
        : typeof layer.resourceType === "string"
          ? layer.resourceType
          : "unknown";
    const backgroundSprite =
      layerType === "GMRBackgroundLayer" &&
      typeof layer["spriteId"] === "object" &&
      layer["spriteId"] !== null &&
      typeof (layer["spriteId"] as Record<string, unknown>)["name"] === "string"
        ? ((layer["spriteId"] as Record<string, unknown>)["name"] as string)
        : undefined;
    return {
      name: layerName,
      type: layerType,
      tiles: parseTiles(layer),
      instances: parseInstances(layer),
      ...(backgroundSprite !== undefined ? { backgroundSprite } : {}),
    };
  });

  return { name, width, height, layers };
}

/**
 * Every real background image this room's layers reference that
 * `buildRoomSceneJSON` has no way to carry into the generated `.scene.json`
 * — see `RoomLayer.backgroundSprite`'s doc comment for why. Used by
 * `importGMS2Project` to warn instead of silently dropping the reference.
 */
export function droppedBackgroundSprites(room: RoomData): string[] {
  return room.layers
    .map((layer) => layer.backgroundSprite)
    .filter((sprite): sprite is string => sprite !== undefined);
}

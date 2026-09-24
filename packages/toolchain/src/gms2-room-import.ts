import { promises as fs } from "node:fs";
import path from "node:path";
import { convertGms2Sprite } from "./gms2-sprite-import.js";

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

/** On-disk shape of a directly-declared entity, matching @emptysock/engine's `SceneFileEntity`. */
export interface RoomBackgroundEntity {
  components: Array<{ component: string; overrides?: Record<string, unknown> }>;
}

/**
 * Convert every real background image a room's `GMRBackgroundLayer`s
 * reference into a real, renderable `SceneFileEntity`: a plain
 * `Transform`+`Sprite` entity, sized to cover the room and placed on
 * `@emptysock/engine`'s built-in `"background"` render layer (`LayerSystem`
 * already defines one, drawn behind `"default"`/`"foreground"`/`"ui"` —
 * see `packages/engine/src/systems/LayerSystem.ts`). This is a direct
 * `SceneFileEntity`, not a `prefabInstances` entry, because a GMS2
 * background image has no corresponding GameMaker *object* and therefore no
 * `.prefab.json` to reference — `SceneFile.entities` exists precisely for
 * "an entity this scene needs that isn't spawned from a named prefab" (see
 * `SceneFile.ts`'s `loadSceneFile`).
 *
 * Copies each referenced sprite's first frame into
 * `<outDir>/assets/backgrounds/<spriteName>/` (mirroring `buildSpriteAsset`'s
 * PNG-copying convention in `gms2-codegen.ts`) and returns one entity
 * descriptor per background layer that had a real `spriteId` set. A
 * `GMRBackgroundLayer` with `spriteId: null` (a plain solid-colour
 * compatibility layer) is not represented here — no image to render — and
 * a background sprite that fails to convert (a real conversion failure or a
 * genuinely missing sprite) is skipped with an entry in `failed`.
 */
export async function convertGms2RoomBackgrounds(
  room: RoomData,
  projectRoot: string,
  outDir: string,
): Promise<{ entities: RoomBackgroundEntity[]; failed: string[] }> {
  const entities: RoomBackgroundEntity[] = [];
  const failed: string[] = [];

  for (const layer of room.layers) {
    const spriteName = layer.backgroundSprite;
    if (spriteName === undefined) continue;

    try {
      const spriteDir = path.join(projectRoot, "sprites", spriteName);
      const sprite = await convertGms2Sprite(spriteDir);
      const firstFrame = sprite.frames[0];
      if (firstFrame === undefined) {
        throw new Error(`sprite "${spriteName}" has no frames`);
      }

      const assetDir = path.join(outDir, "assets", "backgrounds", spriteName);
      await fs.mkdir(assetDir, { recursive: true });
      const destName = "frame_0.png";
      await fs.copyFile(firstFrame.imagePath, path.join(assetDir, destName));

      const texturePath = `./assets/backgrounds/${spriteName}/${destName}`;
      // Sprite has no width/height field of its own (see Sprite.ts) — the
      // only way to make the image actually cover the room is to scale the
      // Transform so the sprite's *native* pixel size maps onto the room's
      // width/height. Without this the background renders at its native
      // texture size regardless of room dimensions, which is not "sized to
      // cover the room" as documented above.
      const nativeWidth = sprite.width > 0 ? sprite.width : room.width;
      const nativeHeight = sprite.height > 0 ? sprite.height : room.height;
      entities.push({
        components: [
          {
            component: "Transform",
            overrides: {
              x: room.width / 2,
              y: room.height / 2,
              scaleX: room.width / nativeWidth,
              scaleY: room.height / nativeHeight,
            },
          },
          {
            component: "Sprite",
            overrides: {
              texturePath,
              layer: "background",
              depth: -1000,
            },
          },
        ],
      });
    } catch (err) {
      failed.push(
        `Room "${room.name}" background sprite "${spriteName}" could not be converted (${String(err)}).`,
      );
    }
  }

  return { entities, failed };
}

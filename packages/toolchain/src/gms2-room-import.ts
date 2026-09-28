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
  /** `GMRBackgroundLayer` `htiled`/`vtiled` (real: 20 of Freedom's 40 background layers are htiled) and its `x`/`y` offset. */
  htiled?: boolean;
  vtiled?: boolean;
  offsetX?: number;
  offsetY?: number;
}

/**
 * One entry of a real room `.yy`'s `views` array (up to 8, index = view
 * slot). Confirmed against GameMaker's real room-view schema — the manual's
 * `view_xport`/`view_yport`/`view_wport`/`view_hport` reference pages, the
 * `NPC-Studio/yy-typings` typings for GMS2 `.yy`/`.yyp` files, and
 * ENIGMA's `room_set_view` compatibility docs (which spells out the same
 * field list GameMaker's own runtime function takes: `vis, xview, yview,
 * wview, hview, xport, yport, wport, hport, hborder, vborder, hspeed,
 * vspeed, obj`) — all agree on this field set and naming. `xview`/`yview`/
 * `wview`/`hview` are the *world-space* rectangle the camera looks at;
 * `xport`/`yport`/`wport`/`hport` are the *screen-space* rectangle it draws
 * into; `hborder`/`vborder` are the follow-margin in pixels; `hspeed`/
 * `vspeed` are the follow catch-up speed in pixels/step (`-1` is
 * GameMaker's own "snap instantly" sentinel); `objectId` is the object
 * asset this view follows (`null`/absent for "no follow target" — GameMaker
 * resolves this to "the first active instance of that object type" every
 * step, not a fixed instance id, which is why this importer resolves it to
 * an object *name* rather than a numeric instance id).
 */
export interface RoomView {
  visible: boolean;
  xview: number;
  yview: number;
  wview: number;
  hview: number;
  xport: number;
  yport: number;
  wport: number;
  hport: number;
  hborder: number;
  vborder: number;
  hspeed: number;
  vspeed: number;
  objectId?: string;
}

export interface RoomData {
  name: string;
  width: number;
  height: number;
  layers: RoomLayer[];
  /** Real GameMaker room-wide `viewSettings.enableViews` (a.k.a. `view_enabled`) — whether this room's viewport/camera system is active at all. */
  viewsEnabled: boolean;
  /** Up to 8 real view slots, parsed from the room's `.yy` `views` array — see `RoomView`'s own doc comment for the exact field provenance. Always length-8-or-fewer, in slot order; a room with no `views` array (or a malformed one) parses to `[]`. */
  views: RoomView[];
}

// ── Internal shapes for the GMS2 room .yy JSON ──────────────────────────────

interface YyInstance {
  // A real GameMaker room can place an instance whose `objectId` is a bare
  // `null` — the room-instance equivalent of a stale/orphaned object
  // reference (the object was deleted from the project after this instance
  // was placed). Confirmed against a real GameMaker project.
  objectId?: { name?: string } | null;
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
  /**
   * A real `GMRTileLayer`'s `tilesetId` reference lives directly on the
   * layer object itself, as a sibling of `tiles` — confirmed against real
   * project data (see `parseTiles`'s doc comment). This module's own
   * pre-existing synthetic test fixtures instead nest it under
   * `tiles.tilesetId`, which no real GameMaker export has been observed to
   * use; `parseTiles` checks this real, top-level field first and falls
   * back to the nested one for that back-compat case.
   */
  tilesetId?: { name?: string } | null;
  tiles?: {
    TileData?: number[][];
    /**
     * The real format every GMS2 room `.yy` actually writes (confirmed
     * against real project data — see `parseTiles`'s doc comment): a flat,
     * row-major array of `SerialiseWidth * SerialiseHeight` raw cell values,
     * not the nested `TileData` shape above. `TileData` is kept only for
     * this module's own pre-existing synthetic test fixtures/back-compat;
     * no real GameMaker export has ever been observed to use it.
     */
    TileSerialiseData?: number[];
    SerialiseWidth?: number;
    SerialiseHeight?: number;
    tilesetId?: { name?: string } | null;
    [key: string]: unknown;
  };
  instances?: YyInstance[];
  [key: string]: unknown;
}

interface YyView {
  visible?: boolean;
  xview?: number;
  yview?: number;
  wview?: number;
  hview?: number;
  xport?: number;
  yport?: number;
  wport?: number;
  hport?: number;
  hborder?: number;
  vborder?: number;
  hspeed?: number;
  vspeed?: number;
  objectId?: { name?: string } | null;
  [key: string]: unknown;
}

interface YyRoom {
  name?: string;
  roomSettings?: { Width?: number; Height?: number; [key: string]: unknown };
  layers?: YyLayer[];
  views?: YyView[];
  /**
   * Real `.yy` field name is `viewSettings.enableViews` (GameMaker's own
   * `view_enabled`). GameMaker's IDE also writes an `inheritViewSettings`
   * flag here for "use the parent room's settings" (default room
   * templates); this importer does not chase room inheritance — a room
   * with `inheritViewSettings: true` and no explicit `enableViews` value of
   * its own is treated the same as `enableViews: false`, an honest default
   * rather than a fabricated inherited value.
   */
  viewSettings?: { enableViews?: boolean; [key: string]: unknown };
  [key: string]: unknown;
}

function isYyRoom(val: unknown): val is YyRoom {
  return typeof val === "object" && val !== null;
}

/**
 * GameMaker's real per-cell tile value packs the tile index into the low
 * bits and three placement flags (rotate/mirror/flip) into the top three
 * bits — confirmed empirically against a real GameMaker project's exported
 * room data (no published byte-level spec was available to check this
 * against offline; see this function's own doc comment for exactly how it
 * was verified). `TileCell` (`@emptysock/tilemap`'s real shape) has no
 * rotate/mirror/flip field, so those three bits are read (to correctly
 * recover the real tile index) but not preserved anywhere — the same
 * "honestly read, then honestly not representable" shape
 * `convertGms2Tileset`'s `asymmetryWarning` already uses for a different
 * field this engine's types don't carry.
 */
const TILE_INDEX_MASK = 0x1fffffff;

/**
 * Parse one tile layer's real placed-tile data.
 *
 * GameMaker's actual `.yy` room format (confirmed against a real, full
 * GameMaker project's exported rooms — every one of that project's tile
 * layers used this shape, none used the nested `TileData` array this
 * function used to assume) is `tiles.TileSerialiseData`: a flat, row-major
 * array of `SerialiseWidth * SerialiseHeight` raw cell values — not a 2D
 * `TileData` array (which does not appear anywhere in real GameMaker
 * exports observed so far; `TileData` support is kept only for this
 * module's pre-existing synthetic test fixtures).
 *
 * A raw cell value's low 29 bits (`TILE_INDEX_MASK`) are the tile's index
 * into its tileset; the top 3 bits (`TILE_FLAG_MASK`) are GameMaker's
 * rotate/mirror/flip placement flags. A cell whose *masked* index is `0` is
 * treated as empty — this is the standard behaviour of GameMaker's tile grid
 * (background/unfilled cells serialise as a value whose masked index is `0`;
 * an actual, real project's fully-populated ground layers verified this:
 * the overwhelming majority of their cells share one exact raw value
 * (`0x80000000` — flip flag set, index 0) that only ever appears where no
 * tile is visually placed, while every other observed, genuinely-placed
 * tile in that same real data carried a small raw value with none of the
 * flag bits set at all). This mirrors the pre-existing nested-`TileData`
 * behaviour, which already treated a raw `0` as empty — the same
 * "index 0 renders as background, not as a real placed tile" limitation now
 * applies uniformly to both formats, not a new regression introduced by
 * flag-masking.
 */
function parseTiles(layer: YyLayer): TileEntry[] {
  const tiles = layer.tiles;
  if (tiles === undefined || typeof tiles !== "object") return [];

  const tilesetId =
    typeof layer.tilesetId === "object" &&
    layer.tilesetId !== null &&
    typeof (layer.tilesetId as Record<string, unknown>)["name"] === "string"
      ? ((layer.tilesetId as Record<string, unknown>)["name"] as string)
      : typeof tiles.tilesetId === "object" &&
          tiles.tilesetId !== null &&
          typeof (tiles.tilesetId as Record<string, unknown>)["name"] ===
            "string"
        ? ((tiles.tilesetId as Record<string, unknown>)["name"] as string)
        : "";

  const result: TileEntry[] = [];

  const flat = tiles.TileSerialiseData;
  const width = tiles.SerialiseWidth;
  if (Array.isArray(flat) && typeof width === "number" && width > 0) {
    flat.forEach((raw, i) => {
      if (typeof raw !== "number") return;
      const tileIndex = raw & TILE_INDEX_MASK;
      if (tileIndex === 0) return;
      result.push({
        tilesetId,
        x: i % width,
        y: Math.floor(i / width),
        tileIndex,
      });
    });
    return result;
  }

  // Back-compat / synthetic-fixture path: the nested TileData shape no real
  // GameMaker export has been observed to use.
  const tileData = Array.isArray(tiles["TileData"])
    ? (tiles["TileData"] as number[][])
    : [];
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

function num(val: unknown, fallback: number): number {
  return typeof val === "number" ? val : fallback;
}

/** Parses a room's real `.yy` `views` array into `RoomView[]`. Missing/malformed entries fall back to GameMaker's own documented view defaults (a full-1280x720 unvisible viewport, `-1` speed sentinel, no border, no follow object) rather than throwing — a room that never touches its view settings in the IDE still writes 8 default-valued entries in a real `.yy` file, so this should never actually need the fallback path against real data, but a hand-edited or malformed file must not abort the whole room's import over it. */
function parseViews(views: unknown): RoomView[] {
  if (!Array.isArray(views)) return [];
  return views.map((raw) => {
    const v = (typeof raw === "object" && raw !== null ? raw : {}) as YyView;
    const objectId =
      typeof v.objectId === "object" &&
      v.objectId !== null &&
      typeof v.objectId["name"] === "string"
        ? v.objectId["name"]
        : undefined;
    return {
      visible: v.visible === true,
      xview: num(v.xview, 0),
      yview: num(v.yview, 0),
      wview: num(v.wview, 1280),
      hview: num(v.hview, 720),
      xport: num(v.xport, 0),
      yport: num(v.yport, 0),
      wport: num(v.wport, 1280),
      hport: num(v.hport, 720),
      hborder: num(v.hborder, 32),
      vborder: num(v.vborder, 32),
      hspeed: num(v.hspeed, -1),
      vspeed: num(v.vspeed, -1),
      ...(objectId !== undefined ? { objectId } : {}),
    };
  });
}

function parseInstances(
  layer: YyLayer,
  guidToObjectName: Readonly<Record<string, string>>,
): InstanceEntry[] {
  const instances = layer.instances;
  if (!Array.isArray(instances)) return [];
  return instances.map((inst) => {
    if (
      typeof inst.objectId === "object" &&
      inst.objectId !== null &&
      typeof (inst.objectId as Record<string, unknown>)["name"] === "string"
    ) {
      return {
        objectName: (inst.objectId as Record<string, unknown>)[
          "name"
        ] as string,
        x: typeof inst.x === "number" ? inst.x : 0,
        y: typeof inst.y === "number" ? inst.y : 0,
      };
    }
    // Legacy room format: no `objectId.name` — just a bare `objId` GUID
    // (see `buildLegacyResourceGuidMap`'s doc comment in gms2-parse.ts).
    const objId = inst["objId"];
    const resolvedName =
      typeof objId === "string" ? guidToObjectName[objId] : undefined;
    return {
      objectName: resolvedName ?? "Unknown",
      x: typeof inst.x === "number" ? inst.x : 0,
      y: typeof inst.y === "number" ? inst.y : 0,
    };
  });
}

/**
 * Convert a GMS2 room .yy file path into a RoomData object.
 * Throws a descriptive Error on missing file, unreadable file, or invalid JSON.
 */
export async function convertGms2Room(
  roomYyPath: string,
  guidToObjectName: Readonly<Record<string, string>> = {},
): Promise<RoomData> {
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
      instances: parseInstances(layer, guidToObjectName),
      ...(backgroundSprite !== undefined ? { backgroundSprite } : {}),
      ...(backgroundSprite !== undefined
        ? {
            htiled: layer["htiled"] === true,
            vtiled: layer["vtiled"] === true,
            offsetX: typeof layer["x"] === "number" ? layer["x"] : 0,
            offsetY: typeof layer["y"] === "number" ? layer["y"] : 0,
          }
        : {}),
    };
  });

  const viewsEnabled = parsed.viewSettings?.enableViews === true;
  const views = parseViews(parsed.views);

  return { name, width, height, layers, viewsEnabled, views };
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

/** On-disk shape of a view entry, matching `@emptysock/engine`'s `SceneFileView` — kept as a locally-typed mirror here rather than a real `import type` for the same reason `RoomBackgroundEntity` below mirrors `SceneFileEntity`: this module stays a plain data-transform with no runtime dependency on the engine package's module graph. */
export interface RoomSceneFileView {
  visible: boolean;
  worldX: number;
  worldY: number;
  worldWidth: number;
  worldHeight: number;
  screenX: number;
  screenY: number;
  screenWidth: number;
  screenHeight: number;
  borderX: number;
  borderY: number;
  speedX: number;
  speedY: number;
  followObject?: string;
}

/**
 * Converts this room's parsed `views` into the runtime-facing `SceneFileView`
 * shape — renaming GameMaker's short `x/y/w/h`-`view`/`port` field names
 * into this engine's own `world*`/`screen*` convention (see `SceneFileView`'s
 * doc comment for why the rename happens at the toolchain boundary, not the
 * runtime one). Used by `gms2-import.ts` to merge onto the generated
 * `.scene.json`'s `views`/`viewsEnabled` fields.
 */
export function buildRoomSceneFileViews(room: RoomData): RoomSceneFileView[] {
  return room.views.map((v) => ({
    visible: v.visible,
    worldX: v.xview,
    worldY: v.yview,
    worldWidth: v.wview,
    worldHeight: v.hview,
    screenX: v.xport,
    screenY: v.yport,
    screenWidth: v.wport,
    screenHeight: v.hport,
    borderX: v.hborder,
    borderY: v.vborder,
    speedX: v.hspeed,
    speedY: v.vspeed,
    ...(v.objectId !== undefined ? { followObject: v.objectId } : {}),
  }));
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
      const htiled = layer.htiled === true;
      const vtiled = layer.vtiled === true;
      if (htiled || vtiled) {
        // Tiled background: repeat the texture (Sprite.sliceMode 2) over a
        // width x height box at native scale. A single-axis tile spans the
        // room on that axis only and keeps the sprite's native size on the
        // other, positioned at the layer's own x/y offset.
        const w = htiled ? room.width : nativeWidth;
        const h = vtiled ? room.height : nativeHeight;
        const ox = htiled ? 0 : (layer.offsetX ?? 0);
        const oy = vtiled ? 0 : (layer.offsetY ?? 0);
        entities.push({
          components: [
            {
              component: "Transform",
              overrides: { x: ox + w / 2, y: oy + h / 2 },
            },
            {
              component: "Sprite",
              overrides: {
                texturePath,
                layer: "background",
                depth: -1000,
                width: w,
                height: h,
                sliceMode: 2,
              },
            },
          ],
        });
        continue;
      }
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

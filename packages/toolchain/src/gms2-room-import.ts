import { promises as fs } from "node:fs";
import path from "node:path";
import { convertGms2Sprite } from "./gms2-sprite-import.js";
import { parseGmsJson } from "./gms2-parse.js";

export interface TileEntry {
  tilesetId: string;
  x: number;
  y: number;
  tileIndex: number;
}

export interface InstanceEntry {
  /** The placed instance's own editor name (`inst_XXXX` in the room `.yy`) when it is a valid scene entity id; becomes the scene entity's stable id so ids survive re-import. */
  id?: string;
  objectName: string;
  x: number;
  y: number;
  /** Per-instance transform/blend from the room `.yy` (defaults: 1, 1, 0, white, 0, 1). */
  scaleX?: number;
  scaleY?: number;
  /** Degrees, GameMaker convention (counter-clockwise positive). */
  rotation?: number;
  /** `0xAABBGGRR`. */
  colour?: number;
  imageIndex?: number;
  imageSpeed?: number;
  /** Variable-definition overrides set on this placed instance in the room editor. */
  gmlVars?: Record<string, number | string | boolean>;
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
   * background image reference in the current `SceneDocument` shape — so this
   * field exists purely so the caller can warn that a real background image
   * was dropped, instead of silently losing it with no note anywhere.
   */
  backgroundSprite?: string;
  /** `GMRBackgroundLayer` `htiled`/`vtiled` (real: 20 of a real project's 40 background layers are htiled) and its `x`/`y` offset. */
  htiled?: boolean;
  vtiled?: boolean;
  offsetX?: number;
  offsetY?: number;
  /** The layer's own `depth` (GameMaker: lower draws in front). */
  depth?: number;
  /** A `GMRAssetLayer`'s placed sprite/sequence elements. */
  assets?: RoomLayerAsset[];
}

/**
 * One element of a `GMRAssetLayer`'s `assets` array: a `GMRSpriteGraphic`
 * (confirmed against real project rooms) or a `GMRSequenceGraphic`
 * (schema from the `yy-typings` project; no real sample was available to
 * check, so this path is covered by synthetic tests only).
 */
export interface RoomLayerAsset {
  kind: "sprite" | "sequence";
  /** The element's own name in the room editor (what `layer_sprite_get_id` looks up). */
  name: string;
  /** The referenced sprite or sequence resource name. */
  assetName: string;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  /** Degrees. */
  rotation: number;
  /** GameMaker 32-bit `0xAABBGGRR` blend colour (`4294967295` = opaque white). */
  colour: number;
  /** Start frame (sprite) or start position in frames (sequence); negative means "unset". */
  headPosition: number;
  /** Playback speed multiplier. */
  animationSpeed: number;
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
  /** Real GameMaker `roomSettings.persistent`; emitted as the scene's `persistent` flag. */
  persistent?: boolean;
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

function instanceTransform(
  inst: Record<string, unknown>,
): Partial<InstanceEntry> {
  const num = (k: string): number | undefined =>
    typeof inst[k] === "number" ? (inst[k] as number) : undefined;
  const out: Partial<InstanceEntry> = {};
  const sx = num("scaleX");
  const sy = num("scaleY");
  const rot = num("rotation");
  const col = num("colour");
  const idx = num("imageIndex");
  const spd = num("imageSpeed");
  if (sx !== undefined) out.scaleX = sx;
  if (sy !== undefined) out.scaleY = sy;
  if (rot !== undefined) out.rotation = rot;
  if (col !== undefined) out.colour = col;
  if (idx !== undefined) out.imageIndex = idx;
  if (spd !== undefined) out.imageSpeed = spd;
  const props = inst["properties"];
  if (Array.isArray(props)) {
    const vars: Record<string, number | string | boolean> = {};
    for (const p of props as Record<string, unknown>[]) {
      const pid = p["propertyId"] as { name?: unknown } | undefined;
      const raw = p["value"];
      if (typeof pid?.name !== "string" || typeof raw !== "string") continue;
      const n = Number(raw);
      vars[pid.name] =
        raw === "True" || raw === "true"
          ? true
          : raw === "False" || raw === "false"
            ? false
            : raw !== "" && !Number.isNaN(n)
              ? n
              : raw;
    }
    if (Object.keys(vars).length > 0) out.gmlVars = vars;
  }
  return out;
}

/** Scene entity ids: `[A-Za-z0-9_-]{1,64}` (see `SceneEntityIdSchema` in `@emptysock/types`). */
const SCENE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function instanceId(inst: Record<string, unknown>): { id?: string } {
  const n = inst["name"];
  return typeof n === "string" && SCENE_ID_RE.test(n) ? { id: n } : {};
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
        ...instanceId(inst),
        x: typeof inst.x === "number" ? inst.x : 0,
        y: typeof inst.y === "number" ? inst.y : 0,
        ...instanceTransform(inst),
      };
    }
    // Legacy room format: no `objectId.name` — just a bare `objId` GUID
    // (see `buildLegacyResourceGuidMap`'s doc comment in gms2-parse.ts).
    const objId = inst["objId"];
    const resolvedName =
      typeof objId === "string" ? guidToObjectName[objId] : undefined;
    return {
      ...instanceId(inst),
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
    const assets = parseLayerAssets(layer);
    return {
      name: layerName,
      type: layerType,
      ...(typeof layer["depth"] === "number" ? { depth: layer["depth"] } : {}),
      ...(assets.length > 0 ? { assets } : {}),
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

  return {
    name,
    width,
    height,
    layers,
    viewsEnabled,
    views,
    ...(settings["persistent"] === true ? { persistent: true } : {}),
  };
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

/** On-disk shape of a view entry, matching `@emptysock/engine`'s `SceneViewDef` — kept as a locally-typed mirror here rather than a real `import type` for the same reason `RoomSceneEntity` below mirrors `SceneEntity`: this module stays a plain data-transform with no runtime dependency on the engine package's module graph. */
export interface RoomSceneViewDef {
  id: string;
  visible: boolean;
  world: { x: number; y: number; w: number; h: number };
  screen: { x: number; y: number; w: number; h: number };
  border: { x: number; y: number };
  speed: { x: number; y: number };
  follow?: { object: string };
}

/**
 * Converts this room's parsed `views` into the runtime-facing `SceneViewDef`
 * shape — renaming GameMaker's short `x/y/w/h`-`view`/`port` field names
 * into this engine's own `world`/`screen` convention. Used by
 * `gms2-import.ts` to merge onto the generated `.scene.json`'s
 * `room.views`/`room.viewsEnabled` fields.
 */
export function buildRoomSceneViews(room: RoomData): RoomSceneViewDef[] {
  return room.views.map((v, i) => ({
    id: `v${i}`,
    visible: v.visible,
    world: { x: v.xview, y: v.yview, w: v.wview, h: v.hview },
    screen: { x: v.xport, y: v.yport, w: v.wport, h: v.hport },
    border: { x: v.hborder, y: v.vborder },
    speed: { x: v.hspeed, y: v.vspeed },
    ...(v.objectId !== undefined ? { follow: { object: v.objectId } } : {}),
  }));
}

/** Intermediate component list an emitter builds before it becomes a scene entity. */
interface RoomEntityDraft {
  components: Array<{ component: string; overrides?: Record<string, unknown> }>;
}

/** On-disk shape of a directly-declared (no prefab) entity, matching @emptysock/engine's `SceneEntity`: a stable `id` plus a name-keyed component-override map. */
export interface RoomSceneEntity {
  id: string;
  components: Record<string, { data: Record<string, unknown> }>;
}

function toSceneEntities(
  drafts: readonly RoomEntityDraft[],
  idPrefix: string,
): RoomSceneEntity[] {
  return drafts.map((d, i) => {
    const components: RoomSceneEntity["components"] = {};
    for (const c of d.components) {
      components[c.component] = { data: { ...(c.overrides ?? {}) } };
    }
    return { id: `${idPrefix}${i}`, components };
  });
}

/**
 * Convert every real background image a room's `GMRBackgroundLayer`s
 * reference into a real, renderable `SceneEntity`: a plain
 * `Transform`+`Sprite` entity, sized to cover the room and placed on
 * `@emptysock/engine`'s built-in `"background"` render layer (`LayerSystem`
 * already defines one, drawn behind `"default"`/`"foreground"`/`"ui"` —
 * see `packages/engine/src/systems/LayerSystem.ts`). This is a direct
 * `SceneEntity` (no `prefab`), not a prefab-instance entry, because a GMS2
 * background image has no corresponding GameMaker *object* and therefore no
 * `.prefab.json` to reference — a `SceneEntity` without `prefab` exists precisely for
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
): Promise<{ entities: RoomSceneEntity[]; failed: string[] }> {
  const entities: RoomEntityDraft[] = [];
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

  return { entities: toSceneEntities(entities, "bg"), failed };
}

/** Parses a `GMRAssetLayer`'s `assets` (sprite and sequence graphics); other asset kinds are ignored. */
function parseLayerAssets(layer: YyLayer): RoomLayerAsset[] {
  const raw = layer["assets"];
  if (!Array.isArray(raw)) return [];
  const out: RoomLayerAsset[] = [];
  for (const item of raw as unknown[]) {
    if (typeof item !== "object" || item === null) continue;
    const a = item as Record<string, unknown>;
    const kind =
      a["resourceType"] === "GMRSpriteGraphic"
        ? "sprite"
        : a["resourceType"] === "GMRSequenceGraphic"
          ? "sequence"
          : undefined;
    if (kind === undefined) continue;
    const ref = a[kind === "sprite" ? "spriteId" : "sequenceId"];
    const assetName =
      typeof ref === "object" &&
      ref !== null &&
      typeof (ref as Record<string, unknown>)["name"] === "string"
        ? ((ref as Record<string, unknown>)["name"] as string)
        : undefined;
    if (assetName === undefined) continue;
    out.push({
      kind,
      name: typeof a["name"] === "string" ? a["name"] : assetName,
      assetName,
      x: num(a["x"], 0),
      y: num(a["y"], 0),
      scaleX: num(a["scaleX"], 1),
      scaleY: num(a["scaleY"], 1),
      rotation: num(a["rotation"], 0),
      colour: num(a["colour"], 0xffffffff),
      headPosition: num(a["headPosition"], 0),
      animationSpeed: num(a["animationSpeed"], 1),
    });
  }
  return out;
}

/**
 * Convert a room's `GMRAssetLayer` sprite/sequence elements into real
 * `SceneDocument.entities` entries. Each carries a `LayerElement` component
 * (`name` = the element's editor name, `layer` = its room layer) so
 * `layer_sprite_get_id`/`layer_sequence_get_instance` can find it at runtime.
 *
 * A sprite element becomes `Transform` + `Sprite` + `LayerElement`, pointing
 * at the texture `buildSpriteAsset` already writes
 * (`./assets/sprites/<name>/frame_{n}.png` when multi-frame, `frame_0.png`
 * otherwise), so no image is copied here. The sprite's origin becomes the
 * `Sprite` anchor (`xorigin / width`, `yorigin / height`) so the element's
 * `x`/`y` are the origin position, as in the room editor. `colour`'s BGR part
 * becomes `Sprite.tint` and its alpha byte `Sprite.alpha`; `rotation` is
 * degrees to radians; layer `depth` is negated onto `Sprite.depth` (GameMaker
 * draws lower depth in front, this engine draws higher `depth` in front).
 * `headPosition` seeds `currentFrame`, `animationSpeed` scales the sprite's
 * own `frameSpeed`.
 *
 * A sequence element becomes `Transform` + `GmlSequenceState` (playing,
 * `speed` = 30 fps x `animationSpeed`, `position` = `headPosition`) +
 * `LayerElement`. It plays only once the game registers the sequence
 * (`registerGmlSequence`, see the migration report). An element whose sprite
 * or sequence cannot be resolved is reported in `failed`, not dropped.
 */
export async function convertGms2RoomLayerElements(
  room: RoomData,
  projectRoot: string,
  knownSequences: ReadonlySet<string>,
): Promise<{
  entities: RoomSceneEntity[];
  failed: string[];
  sequences: string[];
}> {
  const entities: RoomEntityDraft[] = [];
  const failed: string[] = [];
  const sequences = new Set<string>();

  for (const layer of room.layers) {
    for (const asset of layer.assets ?? []) {
      const label = `Room "${room.name}" layer "${layer.name}" ${asset.kind} element "${asset.name}"`;
      const rotation = (-asset.rotation * Math.PI) / 180;
      const transform = {
        component: "Transform",
        overrides: {
          x: asset.x,
          y: asset.y,
          scaleX: asset.scaleX,
          scaleY: asset.scaleY,
          rotation,
        },
      };
      const element = {
        component: "LayerElement",
        overrides: { name: asset.name, layer: layer.name, kind: asset.kind },
      };

      if (asset.kind === "sequence") {
        if (!knownSequences.has(asset.assetName)) {
          failed.push(
            `${label} references sequence "${asset.assetName}", which is not in the project.`,
          );
          continue;
        }
        sequences.add(asset.assetName);
        entities.push({
          components: [
            transform,
            {
              component: "GmlSequenceState",
              overrides: {
                sequenceId: asset.assetName,
                position: Math.max(0, asset.headPosition),
                speed: 30 * asset.animationSpeed,
                playing: true,
              },
            },
            element,
          ],
        });
        continue;
      }

      try {
        const spriteDir = path.join(projectRoot, "sprites", asset.assetName);
        const sprite = await convertGms2Sprite(spriteDir);
        if (sprite.frames.length === 0) {
          throw new Error(`sprite "${asset.assetName}" has no frames`);
        }
        const multi = sprite.frameCount > 1;
        const base = `./assets/sprites/${asset.assetName}/`;
        const { xorigin, yorigin } = await readSpriteOrigin(
          spriteDir,
          asset.assetName,
        );
        const alpha = ((asset.colour >>> 24) & 0xff) / 255;
        const b = (asset.colour >>> 16) & 0xff;
        const g = (asset.colour >>> 8) & 0xff;
        const r = asset.colour & 0xff;
        entities.push({
          components: [
            transform,
            {
              component: "Sprite",
              overrides: {
                texturePath: multi
                  ? `${base}frame_{n}.png`
                  : `${base}frame_0.png`,
                depth: -(layer.depth ?? 0),
                tint: (r << 16) | (g << 8) | b,
                alpha,
                anchorX: sprite.width > 0 ? xorigin / sprite.width : 0.5,
                anchorY: sprite.height > 0 ? yorigin / sprite.height : 0.5,
                width: sprite.width,
                height: sprite.height,
                ...(multi
                  ? {
                      frameCount: sprite.frameCount,
                      frameSpeed:
                        (sprite.frameSpeed ?? 1) * asset.animationSpeed,
                      currentFrame: Math.max(0, asset.headPosition),
                    }
                  : {}),
              },
            },
            element,
          ],
        });
      } catch (err) {
        failed.push(
          `${label} references sprite "${asset.assetName}", which could not be converted (${String(err)}).`,
        );
      }
    }
  }

  return {
    entities: toSceneEntities(entities, "el"),
    failed,
    sequences: [...sequences],
  };
}

/** The sprite's real `.yy` origin (`sequence.xorigin`/`yorigin`), defaulting to 0,0 when absent. */
async function readSpriteOrigin(
  spriteDir: string,
  spriteName: string,
): Promise<{ xorigin: number; yorigin: number }> {
  try {
    const raw = await fs.readFile(
      path.join(spriteDir, `${spriteName}.yy`),
      "utf-8",
    );
    const yy = parseGmsJson(raw) as {
      sequence?: { xorigin?: unknown; yorigin?: unknown };
    };
    return {
      xorigin: num(yy.sequence?.xorigin, 0),
      yorigin: num(yy.sequence?.yorigin, 0),
    };
  } catch {
    return { xorigin: 0, yorigin: 0 };
  }
}

import {
  SCENE_FORMAT_VERSION,
  parseSceneDocument,
  type SceneEntity,
  type ScenePrefabRef,
  type SceneViewDef,
} from "@emptysock/engine";
import type { EditableView, Extra } from "./roomEditorExtras";

/**
 * Room Editor <-> `.scene.json` boundary. The file is a `SceneDocument`
 * (`formatVersion: 2`): reads go through the engine's `parseSceneDocument`
 * (older files without `formatVersion` are migrated on read), writes always
 * emit v2. The editor keeps:
 *  - `instances`: the entities that reference a prefab (edited via their
 *    `prefab.props`), by stable `id` (moves never change ids);
 *  - `extra.entities`: every other entity, verbatim v2 records;
 *  - `extra.views` / `extra.viewsEnabled`: the room's views in the editor's
 *    flat view model (`EditableView`, one `id` per view), rebuilt into
 *    `room.views` on save;
 *  - `extra.room`: the rest of the `room` object (size, layers, ...);
 *  - every other top-level key, preserved verbatim.
 * `order` remembers the original entity order so a save never reorders spawns.
 */

/** A scene entity that spawns from a prefab. */
export type RoomInstance = SceneEntity & { readonly prefab: ScenePrefabRef };

export interface RoomEditorState {
  sceneName: string;
  systems?: readonly string[];
  instances: RoomInstance[];
  /** Every other part of the file (direct entities, views, room, unknown keys), preserved on save. */
  extra: Extra;
  /** Entity ids in original file order. */
  order: readonly string[];
}

/** Room size used only when a document without `room` gains views in the editor (the default). */
const DEFAULT_ROOM = { width: 1024, height: 768 };

export function viewToEditable(v: SceneViewDef): EditableView {
  return {
    id: v.id,
    visible: v.visible,
    worldX: v.world.x,
    worldY: v.world.y,
    worldWidth: v.world.w,
    worldHeight: v.world.h,
    screenX: v.screen.x,
    screenY: v.screen.y,
    screenWidth: v.screen.w,
    screenHeight: v.screen.h,
    borderX: v.border?.x ?? 0,
    borderY: v.border?.y ?? 0,
    speedX: v.speed?.x ?? -1,
    speedY: v.speed?.y ?? -1,
    ...(v.follow?.object !== undefined
      ? { followObject: v.follow.object }
      : {}),
    ...(v.follow?.entity !== undefined
      ? { followEntity: v.follow.entity }
      : {}),
  };
}

export function editableToView(v: EditableView): SceneViewDef {
  const follow =
    v.followObject !== undefined || v.followEntity !== undefined
      ? {
          follow: {
            ...(v.followObject !== undefined ? { object: v.followObject } : {}),
            ...(v.followEntity !== undefined ? { entity: v.followEntity } : {}),
          },
        }
      : {};
  return {
    id: v.id,
    visible: v.visible,
    world: { x: v.worldX, y: v.worldY, w: v.worldWidth, h: v.worldHeight },
    screen: { x: v.screenX, y: v.screenY, w: v.screenWidth, h: v.screenHeight },
    border: { x: v.borderX, y: v.borderY },
    speed: { x: v.speedX, y: v.speedY },
    ...follow,
  };
}

function isInstance(e: SceneEntity): e is RoomInstance {
  return e.prefab !== undefined;
}

export function parseRoomScene(raw: string): RoomEditorState | undefined {
  let doc;
  try {
    doc = parseSceneDocument(JSON.parse(raw));
  } catch {
    return undefined;
  }
  const {
    formatVersion: _fv,
    name,
    systems,
    entities,
    room,
    ...rest
  } = doc as typeof doc & Record<string, unknown>;
  void _fv;
  const extra: Extra = { ...rest };
  const direct = entities.filter((e) => !isInstance(e));
  if (direct.length > 0) extra["entities"] = direct;
  if (room !== undefined) {
    const { views, viewsEnabled, ...roomRest } = room;
    if (views !== undefined) extra["views"] = views.map(viewToEditable);
    if (viewsEnabled !== undefined) extra["viewsEnabled"] = viewsEnabled;
    extra["room"] = roomRest;
  }
  return {
    sceneName: name,
    ...(systems !== undefined ? { systems } : {}),
    instances: entities.filter(isInstance),
    extra,
    order: entities.map((e) => e.id),
  };
}

export function serializeRoomScene(state: RoomEditorState): string {
  const {
    entities: directRaw,
    views,
    viewsEnabled,
    room: roomRest,
    ...rest
  } = state.extra;
  const direct = (directRaw ?? []) as SceneEntity[];
  const byId = new Map<string, SceneEntity>();
  for (const e of [...state.instances, ...direct]) byId.set(e.id, e);
  const entities: SceneEntity[] = [];
  for (const id of state.order) {
    const e = byId.get(id);
    if (e !== undefined) {
      entities.push(e);
      byId.delete(id);
    }
  }
  entities.push(...byId.values());

  const hasRoom =
    roomRest !== undefined || views !== undefined || viewsEnabled !== undefined;
  const room = hasRoom
    ? {
        ...DEFAULT_ROOM,
        ...((roomRest as object | undefined) ?? {}),
        ...(viewsEnabled !== undefined ? { viewsEnabled } : {}),
        ...(views !== undefined
          ? { views: (views as EditableView[]).map(editableToView) }
          : {}),
      }
    : undefined;
  const file = {
    ...rest,
    formatVersion: SCENE_FORMAT_VERSION,
    name: state.sceneName,
    ...(state.systems !== undefined ? { systems: state.systems } : {}),
    ...(room !== undefined ? { room } : {}),
    entities,
  };
  return JSON.stringify(file, null, 2) + "\n";
}

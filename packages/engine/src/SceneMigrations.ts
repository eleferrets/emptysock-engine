import { Diagnostics } from "./Diagnostics.js";
import {
  SCENE_FORMAT_VERSION,
  type SceneComponentEntry,
  type SceneDocument,
  type SceneEntity,
  type SceneViewDef,
} from "./SceneDocument.js";
import type { SerializableRecord } from "./Serializable.js";

/**
 * Scene format migrations. Readers accept every older version; writers emit
 * only `SCENE_FORMAT_VERSION`. Chain: v0 (never-produced `SceneSchema`
 * editor shape) -> v1 (the original runtime `SceneFile`, no `formatVersion`)
 * -> v2 (`SceneDocument`). Pure functions, no engine state.
 */

// ─── Legacy v1 (`SceneFile`) shape ──────────────────────────────────────────

/** v1 component entry (also the `.prefab.json` component entry shape). */
export interface SceneFileV1ComponentEntry {
  readonly component: string;
  readonly overrides?: SerializableRecord;
}

export interface SceneFileV1PrefabInstance {
  readonly prefab: string;
  readonly props?: SerializableRecord;
  readonly gmlVars?: Readonly<Record<string, number | string | boolean>>;
  readonly pool?: boolean;
}

export interface SceneFileV1Entity {
  readonly components: readonly SceneFileV1ComponentEntry[];
}

export interface SceneFileV1View {
  readonly visible: boolean;
  readonly worldX: number;
  readonly worldY: number;
  readonly worldWidth: number;
  readonly worldHeight: number;
  readonly screenX: number;
  readonly screenY: number;
  readonly screenWidth: number;
  readonly screenHeight: number;
  readonly borderX: number;
  readonly borderY: number;
  readonly speedX: number;
  readonly speedY: number;
  readonly followObject?: string;
}

/** The pre-`formatVersion` on-disk scene shape. Read via `migrateScene` only; never written. */
export interface SceneFileV1 {
  readonly sceneName: string;
  readonly systems?: readonly string[];
  readonly prefabInstances?: readonly SceneFileV1PrefabInstance[];
  readonly entities?: readonly SceneFileV1Entity[];
  readonly viewsEnabled?: boolean;
  readonly roomWidth?: number;
  readonly roomHeight?: number;
  readonly views?: readonly SceneFileV1View[];
  readonly persistent?: boolean;
}

type Json = Record<string, unknown>;

function isObject(v: unknown): v is Json {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// ─── v0 -> v1-ish: flatten the editor tree straight into v2 ────────────────

interface V0Entity {
  id?: unknown;
  name?: unknown;
  tags?: unknown;
  active?: unknown;
  components?: unknown;
  children?: unknown;
}

function migrateV0(raw: Json): Json {
  const entities: Json[] = [];
  const used = new Set<string>();
  const walk = (list: unknown, parent: string | undefined): void => {
    if (!Array.isArray(list)) return;
    for (const raw of list as unknown[]) {
      if (!isObject(raw)) continue;
      const item = raw as V0Entity;
      let id = typeof item.id === "string" ? item.id : `e${entities.length}`;
      while (used.has(id)) id = `${id}_`;
      used.add(id);
      const components: Record<string, SceneComponentEntry> = {};
      if (Array.isArray(item.components)) {
        for (const c of item.components) {
          if (isObject(c) && typeof c["type"] === "string") {
            components[c["type"]] = {
              data: isObject(c["data"]) ? { ...c["data"] } : {},
            };
          }
        }
      }
      const e: Json = { id };
      if (typeof item.name === "string") e["name"] = item.name;
      if (Array.isArray(item.tags) && item.tags.length > 0)
        e["tags"] = item.tags;
      if (typeof item.active === "boolean") e["active"] = item.active;
      if (parent !== undefined) e["parent"] = parent;
      if (Object.keys(components).length > 0) e["components"] = components;
      entities.push(e);
      walk(item.children, id);
    }
  };
  walk(raw["entities"], undefined);
  const out: Json = { formatVersion: SCENE_FORMAT_VERSION, entities };
  for (const k of ["id", "name", "backgroundColor", "metadata"]) {
    if (raw[k] !== undefined) out[k] = raw[k];
  }
  return out;
}

// ─── v1 -> v2 ───────────────────────────────────────────────────────────────

function componentsMap(
  entries: readonly SceneFileV1ComponentEntry[],
  context: string,
): Record<string, SceneComponentEntry> {
  const out: Record<string, SceneComponentEntry> = {};
  for (const entry of entries) {
    if (entry.component in out) {
      Diagnostics.logDebugError(
        `${context}: duplicate component "${entry.component}" - the last entry wins.`,
      );
    }
    out[entry.component] = { data: { ...(entry.overrides ?? {}) } };
  }
  return out;
}

function migrateView(v: SceneFileV1View, index: number): SceneViewDef {
  return {
    id: `v${index}`,
    visible: v.visible,
    world: { x: v.worldX, y: v.worldY, w: v.worldWidth, h: v.worldHeight },
    screen: { x: v.screenX, y: v.screenY, w: v.screenWidth, h: v.screenHeight },
    border: { x: v.borderX, y: v.borderY },
    speed: { x: v.speedX, y: v.speedY },
    ...(v.followObject !== undefined
      ? { follow: { object: v.followObject } }
      : {}),
  };
}

/** Migrates a v1 `SceneFile` to a v2 `SceneDocument`. Prefab instances come first, then direct entities (the order v1's `loadSceneFile` spawned). Synthesised ids are `p<i>` / `e<j>`. */
export function migrateSceneV1ToV2(file: SceneFileV1): SceneDocument {
  const entities: SceneEntity[] = [];
  (file.prefabInstances ?? []).forEach((inst, i) => {
    entities.push({
      id: `p${i}`,
      prefab: {
        name: inst.prefab,
        ...(inst.props !== undefined ? { props: inst.props } : {}),
      },
      ...(inst.pool === true ? { pool: true } : {}),
      ...(inst.gmlVars !== undefined
        ? { ext: { gml: { vars: { ...inst.gmlVars } } } }
        : {}),
    });
  });
  (file.entities ?? []).forEach((ent, j) => {
    entities.push({
      id: `e${j}`,
      components: componentsMap(
        ent.components,
        `Scene "${file.sceneName}" entity ${j}`,
      ),
    });
  });
  const hasRoom =
    file.roomWidth !== undefined ||
    file.roomHeight !== undefined ||
    file.viewsEnabled !== undefined ||
    file.views !== undefined;
  const room = hasRoom
    ? {
        width: file.roomWidth ?? 0,
        height: file.roomHeight ?? 0,
        ...(file.viewsEnabled !== undefined
          ? { viewsEnabled: file.viewsEnabled }
          : {}),
        ...(file.views !== undefined
          ? { views: file.views.map(migrateView) }
          : {}),
      }
    : undefined;
  return {
    formatVersion: SCENE_FORMAT_VERSION,
    name: file.sceneName,
    ...(file.persistent !== undefined ? { persistent: file.persistent } : {}),
    ...(file.systems !== undefined ? { systems: file.systems } : {}),
    ...(room !== undefined ? { room } : {}),
    entities,
  };
}

// ─── Public entry points ────────────────────────────────────────────────────

/** Version of a raw scene blob: explicit `formatVersion`, else 1 (`sceneName`) or 0 (editor tree). */
function detectVersion(raw: Json): number {
  const fv = raw["formatVersion"];
  if (fv !== undefined) {
    if (typeof fv !== "number" || !Number.isInteger(fv) || fv < 1) {
      throw new Error(`Scene: invalid formatVersion ${JSON.stringify(fv)}.`);
    }
    return fv;
  }
  if (typeof raw["sceneName"] === "string") return 1;
  if (typeof raw["name"] === "string") return 0;
  throw new Error(
    "Scene: unrecognised scene file (no formatVersion, sceneName or name).",
  );
}

/**
 * Migrates any supported raw scene blob to the latest shape (no validation
 * beyond version detection). A newer `formatVersion` than this engine
 * supports is a hard error naming both versions.
 */
export function migrateScene(raw: unknown): unknown {
  if (!isObject(raw)) throw new Error("Scene: expected a JSON object.");
  const version = detectVersion(raw);
  if (version > SCENE_FORMAT_VERSION) {
    throw new Error(
      `Scene: file formatVersion ${version} is newer than the supported version ${SCENE_FORMAT_VERSION}.`,
    );
  }
  let cur: Json = raw;
  if (version === 0) cur = migrateV0(cur);
  else if (version === 1)
    cur = migrateSceneV1ToV2(cur as unknown as SceneFileV1) as unknown as Json;
  return cur;
}

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function fail(name: string, msg: string): never {
  throw new Error(`Scene "${name}": ${msg}`);
}

/** Structural validation of a v2 document. Mirrors `SceneDocumentSchema` in `@emptysock/types`. */
function validateSceneDocument(doc: Json): SceneDocument {
  const name = doc["name"];
  if (typeof name !== "string" || name === "") {
    throw new Error('Scene: "name" must be a non-empty string.');
  }
  if (!Array.isArray(doc["entities"]))
    fail(name, '"entities" must be an array.');
  const ids = new Set<string>();
  const parents = new Map<string, string>();
  for (const [i, e] of (doc["entities"] as unknown[]).entries()) {
    if (!isObject(e)) fail(name, `entities[${i}] must be an object.`);
    const id = e["id"];
    if (typeof id !== "string" || !ID_RE.test(id))
      fail(name, `entities[${i}] has an invalid id ${JSON.stringify(id)}.`);
    if (ids.has(id)) fail(name, `duplicate entity id "${id}".`);
    ids.add(id);
    if (e["parent"] !== undefined) {
      if (typeof e["parent"] !== "string")
        fail(name, `entity "${id}" has a non-string parent.`);
      parents.set(id, e["parent"]);
    }
    const comps = e["components"];
    if (comps !== undefined) {
      if (!isObject(comps))
        fail(name, `entity "${id}" components must be an object map.`);
      for (const [cn, c] of Object.entries(comps)) {
        if (!isObject(c) || !isObject(c["data"]))
          fail(name, `entity "${id}" component "${cn}" needs a data object.`);
      }
    }
    const prefab = e["prefab"];
    if (
      prefab !== undefined &&
      (!isObject(prefab) ||
        typeof prefab["name"] !== "string" ||
        prefab["name"] === "")
    )
      fail(name, `entity "${id}" has an invalid prefab ref.`);
  }
  for (const [id, parent] of parents) {
    if (!ids.has(parent))
      fail(name, `entity "${id}" has unknown parent "${parent}".`);
  }
  for (const id of parents.keys()) {
    let cur: string | undefined = id;
    for (let hops = 0; cur !== undefined; hops++) {
      cur = parents.get(cur);
      if (cur === id || hops > ids.size)
        fail(name, `entity "${id}" is part of a parent cycle.`);
    }
  }
  const room = doc["room"];
  if (room !== undefined) {
    if (!isObject(room)) fail(name, '"room" must be an object.');
    const views = room["views"];
    if (views !== undefined) {
      if (!Array.isArray(views)) fail(name, '"room.views" must be an array.');
      for (const v of views as unknown[]) {
        const follow = isObject(v) ? v["follow"] : undefined;
        const ref = isObject(follow) ? follow["entity"] : undefined;
        if (isObject(ref) && !ids.has(String(ref["$ref"])))
          fail(name, `a view follows unknown entity "${String(ref["$ref"])}".`);
      }
    }
  }
  return doc as unknown as SceneDocument;
}

/** `migrateScene` + validation. Throws with a descriptive message on bad input. */
export function parseSceneDocument(raw: unknown): SceneDocument {
  const migrated = migrateScene(raw) as Json;
  return validateSceneDocument(migrated);
}

import type { ComponentDef } from "./Component.js";
import { componentRegistry } from "./ComponentRegistry.js";
import { Meta } from "./components/Meta.js";
import { Entity as EntityClass } from "./Entity.js";
import type { Entity } from "./Entity.js";
import {
  entityRefFields,
  entityRefLeaf,
  remapRefs,
  remapValue,
  type EntityIdMap,
  type RemapLeaf,
  type RemapOptions,
} from "./RefRemap.js";
import type { Scene } from "./Scene.js";

/**
 * Carries entities across a scene swap.
 * A new `Scene` is a new bitECS world, so entities cannot move literally:
 * `captureEntities` copies the selected ones (components plus registered
 * per-entity extras) into a plain `SceneSnapshot` and clears their side
 * tables, `restoreEntities` respawns them in another scene and remaps
 * references through the shared two-phase remap (`RefRemap.ts`). Both are
 * synchronous. Core never imports `compat/`: state kept outside components
 * (instance variables, motion) is contributed by `EntityExtra`s.
 */

/** State one entity keeps outside its components (a per-`(World, eid)` side table). */
export interface EntityExtra<T = unknown> {
  readonly name: string;
  /**
   * Schema version of the data `export` produces (default `1`). Stamped into
   * saved room caches; a save written under another version runs `migrate`
   * on load, or the extra's data for that entity is dropped with a warning.
   */
  readonly version?: number;
  /**
   * Brings `data` saved under `fromVersion` up to the current `version`.
   * Only JSON-safe extras are ever saved, so `data` is plain JSON.
   */
  migrate?(data: unknown, fromVersion: number): unknown;
  /** Copy the entity's state, or `undefined` when it has none. */
  export(entity: Entity): T | undefined;
  /** Re-apply `data` to the respawned `entity`. Runs after every entity of the snapshot exists. */
  import(entity: Entity, data: T, ctx: TransferContext): void;
  /** Drop the old `(world, eid)` entry after export (pooled-id hygiene). */
  clear(world: Scene["world"], eid: number): void;
}

/** What `EntityExtra.import` gets to rewrite references held in its data. */
export interface TransferContext {
  readonly scene: Scene;
  /** Old entity id (from the source scene's `idOf`) to the respawned entity. */
  readonly map: EntityIdMap;
  /**
   * Rewrites entity references inside an arbitrary value: `Entity` handles of
   * the source scene and `{ $ref }` values become the respawned entity's
   * handle / fresh ref; references to entities that were not carried become
   * `undefined` (handles) or `NO_REF` (refs). Arrays and plain objects are
   * walked (depth-capped); the possibly-replaced value is returned.
   */
  remap(value: unknown): unknown;
}

export interface TransferPolicy {
  /** Which live entities leave the outgoing scene. */
  select(entity: Entity, scene: Scene): boolean;
  /** Per-entity state kept outside components. */
  readonly extras?: readonly EntityExtra[];
  /** Forwarded to the ref remap (default: `console.warn`). */
  readonly remap?: RemapOptions;
}

/** Default policy: carry entities whose `Meta.persistent` is `true`. */
export const persistentTransferPolicy: TransferPolicy = {
  select: (entity) => entity.get(Meta)?.persistent === true,
};

export interface EntitySnapshot {
  /** The entity's `Scene.idOf` in the source scene. */
  readonly oldId: number;
  readonly oldEid: number;
  readonly components: ReadonlyArray<{
    readonly def: ComponentDef;
    readonly data: Record<string, unknown>;
  }>;
  readonly extras: Readonly<Record<string, unknown>>;
}

export interface SceneSnapshot {
  readonly version: 1;
  /** The source world, so `Entity` handles held in extras can be recognised. */
  readonly world: Scene["world"];
  readonly entities: readonly EntitySnapshot[];
}

function copyValue(v: unknown): unknown {
  return Array.isArray(v) ? [...v] : v;
}

function copyFields(source: object): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(source)) data[k] = copyValue(v);
  return data;
}

/** Live entities of `scene` that carry at least one registered component, by ascending eid. */
function candidates(scene: Scene, defs: readonly ComponentDef[]): Entity[] {
  const byEid = new Map<number, Entity>();
  for (const def of defs) {
    scene.each(def, (_c, entity) => {
      byEid.set(entity.eid, entity);
    });
  }
  return [...byEid.values()].sort((a, b) => a.eid - b.eid);
}

/**
 * Snapshot every entity `policy.select` picks and clear its extras' side
 * tables. Components are shallow-copied (arrays one level) through each def's
 * optional `transfer` hook. The entities themselves are left in `scene`; the
 * caller is about to tear it down.
 */
export function captureEntities(
  scene: Scene,
  policy: TransferPolicy = persistentTransferPolicy,
): SceneSnapshot {
  const defs = componentRegistry.registeredComponents(scene.world);
  const extras = policy.extras ?? [];
  const entities: EntitySnapshot[] = [];
  const selected: Entity[] = [];
  for (const entity of candidates(scene, defs)) {
    if (!policy.select(entity, scene)) continue;
    const components: EntitySnapshot["components"][number][] = [];
    for (const def of defs) {
      const comp = entity.get(def);
      if (comp === undefined) continue;
      let data = copyFields(comp);
      if (def.transfer !== undefined) data = def.transfer(data);
      components.push({ def, data });
    }
    const exported: Record<string, unknown> = {};
    for (const extra of extras) {
      const value = extra.export(entity);
      if (value !== undefined) exported[extra.name] = value;
    }
    entities.push({
      oldId: scene.idOf(entity),
      oldEid: entity.eid,
      components,
      extras: exported,
    });
    selected.push(entity);
  }
  for (const entity of selected) {
    for (const extra of extras) extra.clear(entity.world, entity.eid);
  }
  return { version: 1, world: scene.world, entities };
}

/**
 * Respawn `snapshot` into `scene`: no `onCreate`, no prefab logic. Phase 1
 * spawns every entity with its components; phase 2 rewrites declared
 * `entityRef` fields and lets each extra import its data with a `remap`.
 * Returns the old-id to new-entity map.
 */
export function restoreEntities(
  scene: Scene,
  snapshot: SceneSnapshot,
  policy: TransferPolicy = persistentTransferPolicy,
): EntityIdMap {
  const byOldId = new Map<number, Entity>();
  const byOldEid = new Map<number, number>();
  const restored: Array<{ entity: Entity; snap: EntitySnapshot }> = [];
  for (const snap of snapshot.entities) {
    const entity = scene.spawn();
    for (const { def, data } of snap.components) {
      entity.add(def, copyFields(data) as never);
    }
    byOldId.set(snap.oldId, entity);
    byOldEid.set(snap.oldEid, snap.oldId);
    restored.push({ entity, snap });
  }
  const map: EntityIdMap = { get: (oldId) => byOldId.get(oldId as number) };

  const defs: ComponentDef[] = [];
  const seen = new Set<string>();
  for (const { snap } of restored) {
    for (const { def } of snap.components) {
      if (!seen.has(def.componentName)) {
        seen.add(def.componentName);
        defs.push(def);
      }
    }
  }
  remapRefs(
    scene,
    restored.map((r) => r.entity),
    map,
    defs,
    policy.remap,
  );

  const refLeaf = entityRefLeaf(scene, map, policy.remap, "carried value");
  const leaf: RemapLeaf = (v) => {
    if (v instanceof EntityClass && v.world === snapshot.world) {
      const oldId = byOldEid.get(v.eid);
      return { value: oldId === undefined ? undefined : byOldId.get(oldId) };
    }
    return refLeaf(v);
  };
  const ctx: TransferContext = {
    scene,
    map,
    remap: (value) => remapValue(value, leaf),
  };
  const extras = policy.extras ?? [];
  for (const { entity, snap } of restored) {
    for (const extra of extras) {
      const data = snap.extras[extra.name];
      if (data !== undefined) extra.import(entity, data, ctx);
    }
  }
  return map;
}

const SCAN_DEPTH = 8;

/** Reads every old entity id / old eid a value refers to (handles of `world`, `{ $ref }`). */
function scanRefs(
  value: unknown,
  world: Scene["world"],
  out: { ids: Set<number>; eids: Set<number> },
  depth: number,
  seen: Set<object>,
): void {
  if (typeof value !== "object" || value === null) return;
  if (value instanceof EntityClass) {
    if (value.world === world) out.eids.add(value.eid);
    return;
  }
  if (depth <= 0 || seen.has(value)) return;
  seen.add(value);
  const ref = (value as { $ref?: unknown }).$ref;
  if (typeof ref === "number" && ref !== 0) out.ids.add(ref);
  if (value instanceof Map) {
    for (const v of value.values()) scanRefs(v, world, out, depth - 1, seen);
  } else if (Array.isArray(value)) {
    for (const v of value) scanRefs(v, world, out, depth - 1, seen);
  } else {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return;
    for (const v of Object.values(value))
      scanRefs(v, world, out, depth - 1, seen);
  }
}

/**
 * References held by entities of `from` that point at entities of `to`.
 * Both snapshots must come from the same source scene (same old ids), as when
 * `Game` captures the carried entities and the persistent-room cache entry at
 * one unload. Such references dangle after restore, since each side respawns
 * at a different time and the remap only knows its own entities. Returns one
 * human-readable line per reference (declared `entityRef` fields, plus
 * handles and `{ $ref }` values inside extras).
 */
export function findCrossReferences(
  from: SceneSnapshot,
  to: SceneSnapshot,
): string[] {
  if (from.world !== to.world) return [];
  const targetIds = new Set(to.entities.map((e) => e.oldId));
  const targetEids = new Set(to.entities.map((e) => e.oldEid));
  const found: string[] = [];
  for (const snap of from.entities) {
    for (const { def, data } of snap.components) {
      for (const field of entityRefFields(def)) {
        const id = (data[field] as { $ref?: unknown } | undefined)?.$ref;
        if (typeof id === "number" && targetIds.has(id)) {
          found.push(
            `entity ${snap.oldId} ${def.componentName}.${field} -> entity ${id}`,
          );
        }
      }
    }
    for (const [name, value] of Object.entries(snap.extras)) {
      const hit = { ids: new Set<number>(), eids: new Set<number>() };
      scanRefs(value, from.world, hit, SCAN_DEPTH, new Set());
      for (const id of hit.ids) {
        if (targetIds.has(id))
          found.push(`entity ${snap.oldId} extra "${name}" -> entity ${id}`);
      }
      for (const eid of hit.eids) {
        if (targetEids.has(eid))
          found.push(`entity ${snap.oldId} extra "${name}" -> eid ${eid}`);
      }
    }
  }
  return found;
}

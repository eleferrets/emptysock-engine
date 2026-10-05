import type { ComponentDef } from "./Component.js";
import type { Entity } from "./Entity.js";
import { type EntityIdMap, type RemapOptions } from "./RefRemap.js";
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
export declare const persistentTransferPolicy: TransferPolicy;
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
/**
 * Snapshot every entity `policy.select` picks and clear its extras' side
 * tables. Components are shallow-copied (arrays one level) through each def's
 * optional `transfer` hook. The entities themselves are left in `scene`; the
 * caller is about to tear it down.
 */
export declare function captureEntities(
  scene: Scene,
  policy?: TransferPolicy,
): SceneSnapshot;
/**
 * Respawn `snapshot` into `scene`: no `onCreate`, no prefab logic. Phase 1
 * spawns every entity with its components; phase 2 rewrites declared
 * `entityRef` fields and lets each extra import its data with a `remap`.
 * Returns the old-id to new-entity map.
 */
export declare function restoreEntities(
  scene: Scene,
  snapshot: SceneSnapshot,
  policy?: TransferPolicy,
): EntityIdMap;
/**
 * References held by entities of `from` that point at entities of `to`.
 * Both snapshots must come from the same source scene (same old ids), as when
 * `Game` captures the carried entities and the persistent-room cache entry at
 * one unload. Such references dangle after restore, since each side respawns
 * at a different time and the remap only knows its own entities. Returns one
 * human-readable line per reference (declared `entityRef` fields, plus
 * handles and `{ $ref }` values inside extras).
 */
export declare function findCrossReferences(
  from: SceneSnapshot,
  to: SceneSnapshot,
): string[];

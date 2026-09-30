import type { ComponentDef } from "../Component.js";
import { type RelationDef } from "../Relations.js";
import type { RoomStateCache } from "../RoomStateCache.js";
import type { EntityExtra, SceneSnapshot } from "../SceneTransfer.js";
import type { Scene } from "../Scene.js";
import type { SerializableRecord } from "../Serializable.js";
import { type StorageAdapter } from "./StorageAdapter.js";
import type { GlobalStore } from "./GlobalStore.js";
import type { VariableStore } from "./VariableStore.js";
/** Newest blob `formatVersion` this build reads and the only one it writes. */
export declare const SAVE_FORMAT_VERSION = 2;
/**
 * Thrown by `load`/`peek` when a save was written by a newer build than this
 * one understands. Nothing is loaded in that case.
 */
export declare class SaveFormatError extends Error {
  readonly slotId: string;
  readonly found: unknown;
  readonly supported: number;
  constructor(slotId: string, found: unknown, supported: number);
}
/** Provenance stamped into every v2 save. */
export interface SaveMeta {
  readonly savedAt: number;
  readonly engineVersion?: string;
  readonly gameVersion?: string;
}
/** What `peek` reports without loading anything. */
export interface SaveHeader {
  readonly formatVersion: number;
  readonly meta?: SaveMeta;
  /** Room/scene key current at save time, if the `SaveSystem` was given a `room` provider. */
  readonly room?: string;
}
/**
 * Migrates one component's saved data forward from the version it was saved
 * under to the currently-registered def's version. Register with
 * `SaveSystem.registerMigration`. Whatever it returns is trusted as-is and
 * handed straight to `entity.add()` — it is the component author's job to
 * return a value matching the *current* shape.
 */
export type MigrateFn = (
  oldData: SerializableRecord,
  oldVersion: number,
) => SerializableRecord;
/** Access to an in-flight carry snapshot (the entities between `loadScene({ carry })` and `restoreCarried()`). */
export interface CarriedSlot {
  get(): SceneSnapshot | undefined;
  set(snapshot: SceneSnapshot): void;
}
export interface SaveSystemOptions {
  /**
   * Storage backend. Defaults to an in-memory adapter (safe under Node/
   * Vitest and the headless testing harness); a real game supplies an
   * IndexedDB- or Tauri-fs-backed adapter built outside the engine package
   * — see `StorageAdapter.ts`'s doc comment for why.
   */
  readonly adapter?: StorageAdapter;
  /** Prefix under which slot keys are stored. Defaults to `"emptysock_save_"`. */
  readonly keyPrefix?: string;
  /**
   * Relations to persist besides the built-in `ChildOf`. Edges of relations
   * not listed here are not saved.
   */
  readonly relations?: readonly RelationDef[];
  /** Game services whose state is saved beside the entities: omit either to leave it out. */
  readonly globals?: GlobalStore;
  readonly variables?: VariableStore;
  /**
   * Persistent-room cache (`Game.roomCache`) to save and restore. Only the
   * JSON-safe parts are written: components whose data, and extras whose
   * exported value, are not plain JSON are dropped with a warning.
   */
  readonly rooms?: RoomStateCache;
  /** In-flight carry to save and restore, with the same JSON-safe rule as `rooms`. */
  readonly carried?: CarriedSlot;
  /**
   * The `EntityExtra`s whose data is saved with `rooms`/`carried` (the same
   * ones the scene's transfer policies use). Extras not listed are dropped.
   */
  readonly extras?: readonly EntityExtra[];
  /**
   * Component defs of entities in `rooms`/`carried` beyond the save-aware
   * ones. Saved components with no known def are dropped with a warning.
   */
  readonly transferComponents?: readonly ComponentDef[];
  /** Supplies the current room/scene key stored in the save (see `SaveHeader.room`). */
  readonly room?: () => string | undefined;
  /** Stamped into `meta` so a later build can tell what wrote a save. */
  readonly engineVersion?: string;
  readonly gameVersion?: string;
}
export interface LoadOptions {
  /**
   * `"replace"` (default) destroys the scene's existing entities that carry a
   * save-aware component before loading, so a load yields the saved state
   * rather than saved plus current. `"append"` keeps them (the old behaviour).
   */
  readonly mode?: "replace" | "append";
}
/**
 * ENGINE_DESIGN.md §12.1/§19.3 — generic save/load for any ECS-core component
 * built on the `Serializable` constraint. No per-component save/load code
 * is required for the common case: `SaveSystem` reads every configured
 * component's fields straight off the entity via the name-keyed component
 * lookup already in `Entity`/`ComponentRegistry`.
 *
 * A `SaveSystem` is bound to one `Scene` and one explicit list of
 * "save-aware" `ComponentDef`s at construction. The explicit list (rather
 * than some global "every component ever defined" registry) mirrors
 * `scene.each(...)`'s own design — Scene/ComponentRegistry deliberately
 * don't track a global list of every `ComponentDef` that has ever existed,
 * only per-world, per-name storage — and keeps `SaveSystem` from silently
 * saving components a game never intended to persist (e.g. purely-visual
 * runtime state).
 */
export declare class SaveSystem {
  private readonly _scene;
  private readonly _components;
  private readonly _migrations;
  private readonly _adapter;
  private readonly _keyPrefix;
  private readonly _relations;
  private readonly _options;
  constructor(
    scene: Scene,
    components: readonly ComponentDef[],
    options?: SaveSystemOptions,
  );
  /**
   * Register a migration for `componentName`, run on load when a saved
   * instance's stamped version doesn't match the currently-registered
   * def's version. Only one migration per component name is kept — the
   * latest registration wins — since it is expected to migrate from
   * whatever old version is found straight to the current one in one step.
   */
  registerMigration(componentName: string, migrate: MigrateFn): void;
  /**
   * Snapshot every live entity's save-aware components and persist them
   * under `slotId`.
   */
  save(slotId: string): Promise<void>;
  /** `true` if a save exists under `slotId`. */
  hasSave(slotId: string): Promise<boolean>;
  /** All slot ids currently saved. */
  listSlots(): Promise<string[]>;
  /** Delete a save slot. No-op if it doesn't exist. */
  deleteSave(slotId: string): Promise<void>;
  /**
   * Load `slotId` into this `SaveSystem`'s scene, spawning one fresh entity
   * per saved entity and re-populating its components by name. A
   * version-mismatched component either runs its registered `migrate()`
   * hook, or — if none is registered — logs a warning and drops just that
   * component's data. Neither case throws or aborts the rest of the load;
   * a corrupt/outdated single component never corrupts the whole save.
   *
   * Returns `false` (and loads nothing) if the slot doesn't exist.
   */
  load(slotId: string, options?: LoadOptions): Promise<boolean>;
  /** Header of `slotId` (version, provenance, room) without loading it; `null` if absent or unreadable. Throws `SaveFormatError` for a newer format. */
  peek(slotId: string): Promise<SaveHeader | null>;
  /**
   * Read and version-check a slot. `null` when missing or not valid JSON
   * (warned); throws `SaveFormatError` for a `formatVersion` newer than
   * `SAVE_FORMAT_VERSION`, before anything is touched. A blob without a
   * numeric `formatVersion` is treated as v1. Older versions load as-is: v1
   * differs from v2 only by fields v2 makes optional, so no rewrite is needed.
   */
  private _read;
  /** Def lookup for saved components: save-aware ones first, then `transferComponents`. */
  private _defFor;
  /**
   * Resolves one saved component to its def and current-shape data: runs the
   * registered migration on a version mismatch (or warns and drops when there
   * is none) and strips fields the current def no longer has. `undefined`
   * means "drop this component".
   */
  private _migrateComponent;
  /** Reduces `snapshot` to its JSON-safe parts; everything else is warned about and dropped. */
  private _serializeSnapshot;
  /** Inverse of `_serializeSnapshot`: migrates components and extras, drops what cannot be read. */
  private _deserializeSnapshot;
  private _loadRoomsAndCarry;
  /** Destroy every live entity that carries a save-aware component. */
  private _clearSaved;
  private _snapshot;
  private _serializeRooms;
}

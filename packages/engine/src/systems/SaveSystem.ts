import type { ComponentDef } from "../Component.js";
import type { Entity } from "../Entity.js";
import { ChildOf, type RelationDef } from "../Relations.js";
import { remapRefs } from "../RefRemap.js";
import type { RoomStateCache } from "../RoomStateCache.js";
import type {
  EntityExtra,
  EntitySnapshot,
  SceneSnapshot,
} from "../SceneTransfer.js";
import type { Scene } from "../Scene.js";
import type { SerializableRecord } from "../Serializable.js";
import { MemoryStorageAdapter, type StorageAdapter } from "./StorageAdapter.js";
import type { GlobalStore } from "./GlobalStore.js";
import type { VariableStore, VariableStoreData } from "./VariableStore.js";

/** Newest blob `formatVersion` this build reads and the only one it writes. */
export const SAVE_FORMAT_VERSION = 2;

/**
 * Thrown by `load`/`peek` when a save was written by a newer build than this
 * one understands. Nothing is loaded in that case.
 */
export class SaveFormatError extends Error {
  constructor(
    readonly slotId: string,
    readonly found: unknown,
    readonly supported: number,
  ) {
    super(
      `Save slot "${slotId}" has formatVersion ${String(found)}, but this build only reads up to ${supported}. Update the game to load it.`,
    );
    this.name = "SaveFormatError";
  }
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

/** One saved component instance, stamped with the schema version it was saved under. */
interface SavedComponent {
  readonly version: number;
  readonly data: SerializableRecord;
}

/** One entity of a saved `SceneSnapshot`. */
interface SavedSnapshotEntity {
  readonly oldId: number;
  readonly oldEid: number;
  readonly components: Record<string, SavedComponent>;
  readonly extras: Record<
    string,
    { readonly version: number; readonly data: unknown }
  >;
}

/** A `SceneSnapshot` reduced to its JSON-safe parts. `version` is the snapshot shape's own version. */
interface SavedSnapshot {
  readonly version: 1;
  readonly entities: readonly SavedSnapshotEntity[];
}

/** One saved entity: every save-aware component it carried, keyed by componentName. */
interface SavedEntity {
  /** The entity's scene `EntityId` at save time (absent in v1 blobs). */
  readonly id?: number;
  readonly components: Record<string, SavedComponent>;
}

/** The on-disk/in-storage save blob shape. `formatVersion` is this shape's own version, not any component's. */
interface SaveBlob {
  /** 1: entities only. 2: adds entity ids, relations and the optional service sections below. */
  readonly formatVersion: number;
  /** v2: provenance. */
  readonly meta?: SaveMeta;
  /** v2: current room/scene key (see `SaveSystemOptions.room`). */
  readonly room?: string;
  /** v2: `GlobalStore.snapshot()` (declared `persist: true` names only). */
  readonly globals?: Record<string, unknown>;
  /** v2: `VariableStore.snapshot()`. */
  readonly variables?: VariableStoreData;
  readonly entities: readonly SavedEntity[];
  /** v2, optional: `Game.roomCache` (persistent rooms), JSON-safe parts only, by room key. */
  readonly rooms?: Record<string, SavedSnapshot>;
  /** v2, optional: in-flight carry (`SaveSystemOptions.carried`), JSON-safe parts only. */
  readonly carried?: SavedSnapshot;
  /** v2: relation edges between saved entities, by saved `id` and relation name. */
  readonly relations?: readonly SavedRelation[];
}

interface SavedRelation {
  readonly subject: number;
  readonly relation: string;
  readonly target: number;
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
 * the engine design notes/§19.3 — generic save/load for any ECS-core component
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
export class SaveSystem {
  private readonly _scene: Scene;
  private readonly _components: ReadonlyMap<string, ComponentDef>;
  private readonly _migrations = new Map<string, MigrateFn>();
  private readonly _adapter: StorageAdapter;
  private readonly _keyPrefix: string;
  private readonly _relations: ReadonlyMap<string, RelationDef>;
  private readonly _options: SaveSystemOptions;

  constructor(
    scene: Scene,
    components: readonly ComponentDef[],
    options: SaveSystemOptions = {},
  ) {
    this._scene = scene;
    this._components = new Map(
      components.map((def) => [def.componentName, def]),
    );
    this._options = options;
    this._adapter = options.adapter ?? new MemoryStorageAdapter();
    this._keyPrefix = options.keyPrefix ?? "emptysock_save_";
    this._relations = new Map(
      [ChildOf, ...(options.relations ?? [])].map((r) => [r.name, r]),
    );
  }

  /**
   * Register a migration for `componentName`, run on load when a saved
   * instance's stamped version doesn't match the currently-registered
   * def's version. Only one migration per component name is kept — the
   * latest registration wins — since it is expected to migrate from
   * whatever old version is found straight to the current one in one step.
   */
  registerMigration(componentName: string, migrate: MigrateFn): void {
    this._migrations.set(componentName, migrate);
  }

  /**
   * Snapshot every live entity's save-aware components and persist them
   * under `slotId`.
   */
  async save(slotId: string): Promise<void> {
    const blob: SaveBlob = this._snapshot();
    await this._adapter.set(this._keyPrefix + slotId, JSON.stringify(blob));
  }

  /** `true` if a save exists under `slotId`. */
  async hasSave(slotId: string): Promise<boolean> {
    return (await this._adapter.get(this._keyPrefix + slotId)) !== null;
  }

  /** All slot ids currently saved. */
  async listSlots(): Promise<string[]> {
    const keys = await this._adapter.listKeys(this._keyPrefix);
    return keys.map((key) => key.slice(this._keyPrefix.length));
  }

  /** Delete a save slot. No-op if it doesn't exist. */
  async deleteSave(slotId: string): Promise<void> {
    await this._adapter.delete(this._keyPrefix + slotId);
  }

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
  async load(slotId: string, options: LoadOptions = {}): Promise<boolean> {
    const blob = await this._read(slotId);
    if (blob === null) return false;

    if ((options.mode ?? "replace") === "replace") this._clearSaved();

    // Phase 1: spawn everything, recording saved id -> new entity.
    const byOldId = new Map<number, Entity>();
    const spawned: Entity[] = [];
    for (const savedEntity of blob.entities) {
      const entity = this._scene.spawn();
      spawned.push(entity);
      if (savedEntity.id !== undefined) byOldId.set(savedEntity.id, entity);
      for (const [componentName, saved] of Object.entries(
        savedEntity.components,
      )) {
        const resolved = this._migrateComponent(slotId, componentName, saved);
        if (resolved === undefined) continue;
        const { def, data } = resolved;
        entity.add(def, data);
      }
    }

    // Phase 2: rewrite declared entityRef fields, then re-create edges.
    remapRefs(this._scene, spawned, byOldId, [...this._components.values()]);
    for (const edge of blob.relations ?? []) {
      const def = this._relations.get(edge.relation);
      const subject = byOldId.get(edge.subject);
      const target = byOldId.get(edge.target);
      if (def === undefined || subject === undefined || target === undefined) {
        console.warn(
          `[SaveSystem] Save slot "${slotId}" has a relation edge "${edge.relation}" (${edge.subject} -> ${edge.target}) that cannot be restored - dropped.`,
        );
        continue;
      }
      try {
        this._scene.relate(subject, def, target);
      } catch (e) {
        console.warn(
          `[SaveSystem] Save slot "${slotId}": relation "${edge.relation}" not restored: ${(e as Error).message}`,
        );
      }
    }

    this._loadRoomsAndCarry(slotId, blob);
    if (blob.globals !== undefined)
      this._options.globals?.restore(blob.globals);
    if (blob.variables !== undefined) {
      this._options.variables?.restore(blob.variables);
    }
    return true;
  }

  /** Header of `slotId` (version, provenance, room) without loading it; `null` if absent or unreadable. Throws `SaveFormatError` for a newer format. */
  async peek(slotId: string): Promise<SaveHeader | null> {
    const blob = await this._read(slotId);
    if (blob === null) return null;
    return {
      formatVersion: blob.formatVersion,
      ...(blob.meta !== undefined ? { meta: blob.meta } : {}),
      ...(blob.room !== undefined ? { room: blob.room } : {}),
    };
  }

  /**
   * Read and version-check a slot. `null` when missing or not valid JSON
   * (warned); throws `SaveFormatError` for a `formatVersion` newer than
   * `SAVE_FORMAT_VERSION`, before anything is touched. A blob without a
   * numeric `formatVersion` is treated as v1. Older versions load as-is: v1
   * differs from v2 only by fields v2 makes optional, so no rewrite is needed.
   */
  private async _read(slotId: string): Promise<SaveBlob | null> {
    const raw = await this._adapter.get(this._keyPrefix + slotId);
    if (raw === null) return null;
    let blob: SaveBlob;
    try {
      blob = JSON.parse(raw) as SaveBlob;
    } catch {
      console.warn(
        `[SaveSystem] Save slot "${slotId}" is not valid JSON — nothing loaded.`,
      );
      return null;
    }
    const found: unknown = (blob as { formatVersion?: unknown }).formatVersion;
    const version = typeof found === "number" ? found : 1;
    if (version > SAVE_FORMAT_VERSION) {
      throw new SaveFormatError(slotId, found, SAVE_FORMAT_VERSION);
    }
    return { ...blob, formatVersion: version };
  }

  /** Def lookup for saved components: save-aware ones first, then `transferComponents`. */
  private _defFor(name: string): ComponentDef | undefined {
    const own = this._components.get(name);
    if (own !== undefined) return own;
    return this._options.transferComponents?.find(
      (d) => d.componentName === name,
    );
  }

  /**
   * Resolves one saved component to its def and current-shape data: runs the
   * registered migration on a version mismatch (or warns and drops when there
   * is none) and strips fields the current def no longer has. `undefined`
   * means "drop this component".
   */
  private _migrateComponent(
    slotId: string,
    componentName: string,
    saved: SavedComponent,
  ): { def: ComponentDef; data: SerializableRecord } | undefined {
    const def = this._defFor(componentName);
    if (def === undefined) {
      console.warn(
        `[SaveSystem] Save slot "${slotId}" has an unrecognized component "${componentName}" — dropped.`,
      );
      return undefined;
    }
    let data = saved.data;
    if (saved.version !== def.version) {
      const migrate = this._migrations.get(componentName);
      if (migrate === undefined) {
        console.warn(
          `[SaveSystem] Component "${componentName}" saved at version ${saved.version} but the current def is version ${def.version}, and no migrate() is registered — dropping this component's saved data for one entity.`,
        );
        return undefined;
      }
      data = migrate(saved.data, saved.version);
    }
    const knownFields = new Set(Object.keys(def.createDefaults()));
    const unknownFields = Object.keys(data).filter(
      (field) => !knownFields.has(field),
    );
    if (unknownFields.length > 0) {
      console.warn(
        `[SaveSystem] Component "${componentName}" saved data has unrecognized field(s) [${unknownFields.join(", ")}] not in the current def's shape — dropped, rest of the component loaded.`,
      );
      data = Object.fromEntries(
        Object.entries(data).filter(([field]) => knownFields.has(field)),
      ) as SerializableRecord;
    }
    return { def, data };
  }

  /** Reduces `snapshot` to its JSON-safe parts; everything else is warned about and dropped. */
  private _serializeSnapshot(
    what: string,
    snapshot: SceneSnapshot,
  ): SavedSnapshot {
    const extras = new Map(
      (this._options.extras ?? []).map((x) => [x.name, x]),
    );
    const entities: SavedSnapshotEntity[] = [];
    for (const snap of snapshot.entities) {
      const components: Record<string, SavedComponent> = {};
      for (const { def, data } of snap.components) {
        if (!isJsonSafe(data)) {
          console.warn(
            `[SaveSystem] ${what}: component "${def.componentName}" of entity ${snap.oldId} is not JSON-safe - not saved.`,
          );
          continue;
        }
        components[def.componentName] = {
          version: def.version,
          data: data as SerializableRecord,
        };
      }
      const savedExtras: SavedSnapshotEntity["extras"] = {};
      for (const [name, value] of Object.entries(snap.extras)) {
        const extra = extras.get(name);
        if (extra === undefined) {
          console.warn(
            `[SaveSystem] ${what}: extra "${name}" of entity ${snap.oldId} is not listed in SaveSystemOptions.extras - not saved.`,
          );
        } else if (!isJsonSafe(value)) {
          console.warn(
            `[SaveSystem] ${what}: extra "${name}" of entity ${snap.oldId} is not JSON-safe - not saved.`,
          );
        } else {
          savedExtras[name] = { version: extra.version ?? 1, data: value };
        }
      }
      entities.push({
        oldId: snap.oldId,
        oldEid: snap.oldEid,
        components,
        extras: savedExtras,
      });
    }
    return { version: 1, entities };
  }

  /** Inverse of `_serializeSnapshot`: migrates components and extras, drops what cannot be read. */
  private _deserializeSnapshot(
    slotId: string,
    saved: SavedSnapshot,
  ): SceneSnapshot {
    const extras = new Map(
      (this._options.extras ?? []).map((x) => [x.name, x]),
    );
    const entities: EntitySnapshot[] = [];
    for (const se of saved.entities) {
      const components: Array<EntitySnapshot["components"][number]> = [];
      for (const [name, sc] of Object.entries(se.components)) {
        const resolved = this._migrateComponent(slotId, name, sc);
        if (resolved !== undefined) {
          components.push({ def: resolved.def, data: { ...resolved.data } });
        }
      }
      const restored: Record<string, unknown> = {};
      for (const [name, se2] of Object.entries(se.extras)) {
        const extra = extras.get(name);
        if (extra === undefined) {
          console.warn(
            `[SaveSystem] Save slot "${slotId}" has extra "${name}" that is not registered - dropped.`,
          );
          continue;
        }
        const current = extra.version ?? 1;
        if (se2.version === current) {
          restored[name] = se2.data;
        } else if (extra.migrate !== undefined) {
          const migrated = extra.migrate(se2.data, se2.version);
          if (migrated !== undefined) restored[name] = migrated;
        } else {
          console.warn(
            `[SaveSystem] Extra "${name}" saved at version ${se2.version} but the current version is ${current}, and it has no migrate() - dropping its saved data for one entity.`,
          );
        }
      }
      entities.push({
        oldId: se.oldId,
        oldEid: se.oldEid,
        components,
        extras: restored,
      });
    }
    return { version: 1, world: this._scene.world, entities };
  }

  private _loadRoomsAndCarry(slotId: string, blob: SaveBlob): void {
    const { rooms, carried } = this._options;
    if (rooms !== undefined && blob.rooms !== undefined) {
      rooms.clear();
      for (const [key, saved] of Object.entries(blob.rooms)) {
        rooms.store(key, this._deserializeSnapshot(slotId, saved));
      }
    }
    if (carried !== undefined && blob.carried !== undefined) {
      carried.set(this._deserializeSnapshot(slotId, blob.carried));
    }
  }

  /** Destroy every live entity that carries a save-aware component. */
  private _clearSaved(): void {
    const doomed = new Map<number, Entity>();
    for (const def of this._components.values()) {
      this._scene.each(def, (_c, entity) => {
        doomed.set(entity.eid, entity);
      });
    }
    for (const entity of doomed.values()) this._scene.destroy(entity);
  }

  private _snapshot(): SaveBlob {
    const byEid = new Map<
      number,
      { entity: Entity; components: Record<string, SavedComponent> }
    >();

    for (const def of this._components.values()) {
      this._scene.each(def, (component, entity) => {
        let rec = byEid.get(entity.eid);
        if (rec === undefined) {
          rec = { entity, components: {} };
          byEid.set(entity.eid, rec);
        }
        rec.components[def.componentName] = {
          version: def.version,
          data: { ...component } as SerializableRecord,
        };
      });
    }

    const entities: SavedEntity[] = [];
    const relations: SavedRelation[] = [];
    for (const { entity, components } of byEid.values()) {
      entities.push({ id: this._scene.idOf(entity), components });
    }
    // Stable order (by scene id) so saves diff cleanly regardless of def order.
    entities.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
    for (const { entity } of byEid.values()) {
      for (const def of this._relations.values()) {
        for (const target of this._scene.targetsOf(entity, def)) {
          if (!byEid.has(target.eid)) continue;
          relations.push({
            subject: this._scene.idOf(entity),
            relation: def.name,
            target: this._scene.idOf(target),
          });
        }
      }
    }
    const opts = this._options;
    const room = opts.room?.();
    const meta: SaveMeta = {
      savedAt: Date.now(),
      ...(opts.engineVersion !== undefined
        ? { engineVersion: opts.engineVersion }
        : {}),
      ...(opts.gameVersion !== undefined
        ? { gameVersion: opts.gameVersion }
        : {}),
    };
    const rooms = this._serializeRooms();
    const carriedSnap = opts.carried?.get();
    return {
      formatVersion: SAVE_FORMAT_VERSION,
      meta,
      ...(room !== undefined ? { room } : {}),
      ...(opts.globals !== undefined
        ? { globals: opts.globals.snapshot() }
        : {}),
      ...(opts.variables !== undefined
        ? { variables: opts.variables.snapshot() }
        : {}),
      entities,
      relations,
      ...(rooms !== undefined ? { rooms } : {}),
      ...(carriedSnap !== undefined
        ? { carried: this._serializeSnapshot("in-flight carry", carriedSnap) }
        : {}),
    };
  }

  private _serializeRooms(): Record<string, SavedSnapshot> | undefined {
    const cache = this._options.rooms;
    if (cache === undefined) return undefined;
    const out: Record<string, SavedSnapshot> = {};
    for (const key of cache.keys()) {
      const snap = cache.peek(key);
      if (snap !== undefined) {
        out[key] = this._serializeSnapshot(`room "${key}"`, snap);
      }
    }
    return out;
  }
}

/** `true` when `v` survives a JSON round trip unchanged: primitives, arrays and plain objects of the same. */
function isJsonSafe(v: unknown, depth = 32): boolean {
  if (depth <= 0) return false;
  if (v === null) return true;
  switch (typeof v) {
    case "string":
    case "boolean":
      return true;
    case "number":
      return Number.isFinite(v);
    case "object": {
      if (Array.isArray(v)) return v.every((x) => isJsonSafe(x, depth - 1));
      const proto = Object.getPrototypeOf(v) as unknown;
      if (proto !== Object.prototype && proto !== null) return false;
      return Object.values(v).every((x) => isJsonSafe(x, depth - 1));
    }
    default:
      return false;
  }
}

import type { ComponentDef } from "../Component.js";
import type { Scene } from "../Scene.js";
import type { SerializableRecord } from "../Serializable.js";
import { MemoryStorageAdapter, type StorageAdapter } from "./StorageAdapter.js";

/** One saved component instance, stamped with the schema version it was saved under. */
interface SavedComponent {
  readonly version: number;
  readonly data: SerializableRecord;
}

/** One saved entity: every save-aware component it carried, keyed by componentName. */
interface SavedEntity {
  readonly components: Record<string, SavedComponent>;
}

/** The on-disk/in-storage save blob shape. `formatVersion` is this shape's own version, not any component's. */
interface SaveBlob {
  readonly formatVersion: 1;
  readonly entities: readonly SavedEntity[];
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
}

/**
 * ENGINE_DESIGN.md §12.1/§19.3 — generic save/load for any v2 component
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

  constructor(
    scene: Scene,
    components: readonly ComponentDef[],
    options: SaveSystemOptions = {},
  ) {
    this._scene = scene;
    this._components = new Map(
      components.map((def) => [def.componentName, def]),
    );
    this._adapter = options.adapter ?? new MemoryStorageAdapter();
    this._keyPrefix = options.keyPrefix ?? "emptysock_save_";
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
    const blob: SaveBlob = {
      formatVersion: 1,
      entities: this._snapshotEntities(),
    };
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
  async load(slotId: string): Promise<boolean> {
    const raw = await this._adapter.get(this._keyPrefix + slotId);
    if (raw === null) return false;

    let blob: SaveBlob;
    try {
      blob = JSON.parse(raw) as SaveBlob;
    } catch {
      console.warn(
        `[SaveSystem] Save slot "${slotId}" is not valid JSON — nothing loaded.`,
      );
      return false;
    }

    for (const savedEntity of blob.entities) {
      const entity = this._scene.spawn();
      for (const [componentName, saved] of Object.entries(
        savedEntity.components,
      )) {
        const def = this._components.get(componentName);
        if (def === undefined) {
          console.warn(
            `[SaveSystem] Save slot "${slotId}" has an unrecognized component "${componentName}" — dropped.`,
          );
          continue;
        }

        let data = saved.data;
        if (saved.version !== def.version) {
          const migrate = this._migrations.get(componentName);
          if (migrate !== undefined) {
            data = migrate(saved.data, saved.version);
          } else {
            console.warn(
              `[SaveSystem] Component "${componentName}" saved at version ${saved.version} but the current def is version ${def.version}, and no migrate() is registered — dropping this component's saved data for one entity.`,
            );
            continue;
          }
        }

        entity.add(def, data);
      }
    }

    return true;
  }

  private _snapshotEntities(): SavedEntity[] {
    const byEid = new Map<number, Record<string, SavedComponent>>();

    for (const def of this._components.values()) {
      this._scene.each(def, (component, entity) => {
        let components = byEid.get(entity.eid);
        if (components === undefined) {
          components = {};
          byEid.set(entity.eid, components);
        }
        components[def.componentName] = {
          version: def.version,
          data: { ...component } as SerializableRecord,
        };
      });
    }

    return [...byEid.values()].map((components) => ({ components }));
  }
}

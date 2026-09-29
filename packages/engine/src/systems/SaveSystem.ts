import type { ComponentDef } from "../Component.js";
import type { Entity } from "../Entity.js";
import { ChildOf, type RelationDef } from "../Relations.js";
import { remapRefs } from "../RefRemap.js";
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
  /** The entity's scene `EntityId` at save time (absent in v1 blobs). */
  readonly id?: number;
  readonly components: Record<string, SavedComponent>;
}

/** The on-disk/in-storage save blob shape. `formatVersion` is this shape's own version, not any component's. */
interface SaveBlob {
  readonly formatVersion: 1 | 2;
  readonly entities: readonly SavedEntity[];
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
export class SaveSystem {
  private readonly _scene: Scene;
  private readonly _components: ReadonlyMap<string, ComponentDef>;
  private readonly _migrations = new Map<string, MigrateFn>();
  private readonly _adapter: StorageAdapter;
  private readonly _keyPrefix: string;
  private readonly _relations: ReadonlyMap<string, RelationDef>;

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

    return true;
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
    return { formatVersion: 2, entities, relations };
  }
}

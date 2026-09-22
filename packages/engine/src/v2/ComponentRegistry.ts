import { query, registerComponent as bitecsRegisterComponent } from "bitecs";
import type { World } from "bitecs";
import type { ComponentDef } from "./Component.js";
import type { SerializableRecord } from "./Serializable.js";

/**
 * Storage bookkeeping for one registered component name *within one bitECS
 * world*. `store` is the plain object of parallel arrays bitECS reads/
 * writes directly (ENGINE_DESIGN.md §21) — one array per field, indexed by
 * entity id. It is created once per (world, componentName) pair and reused
 * for that world's lifetime: this is what makes component identity survive
 * hot-reload (§23.1) even though bitECS itself keys a component's storage
 * by *object reference*, and a hot-swapped module re-evaluates
 * `defineComponent(...)` into a brand new object every time — as long as
 * the world itself survives the hot-swap (a running `Scene`'s world does),
 * the same `componentName` always resolves back to the same storage.
 */
interface RegisteredComponent {
  readonly componentName: string;
  /** Field name -> parallel array, the actual bitECS component reference. */
  readonly store: Record<string, unknown[]>;
  /**
   * The exact `ComponentDef` object last seen for this name. `ensure()` is
   * called on every frame-normal access (`entity.get()`, `scene.each()`,
   * …), not just after a hot-swap, and the overwhelmingly common case is
   * the *same* module-level `const` def object coming back unchanged. This
   * reference check is what lets that path skip shape diffing entirely —
   * diffing only runs when a genuinely different object shows up for this
   * `componentName`, which only happens via a re-evaluated
   * `defineComponent(...)` call (§23.1).
   */
  lastDef: ComponentDef;
  /**
   * `typeof` of each field in the def's *declared* defaults, snapshotted at
   * last registration/reset. Deliberately not derived from live entity
   * data: a field's runtime value routinely differs in type from its
   * initial default (e.g. `PhysicsBody.bodyHandle` starts `null` and is
   * later assigned a real numeric handle) — diffing against *that* would
   * misfire a shape-change on ordinary gameplay mutation, not just a hot-
   * swap. Comparing declared-default typeof instead only reacts to an
   * actual field add/remove/type change in the component's own shape.
   */
  fieldTypes: Record<string, string>;
}

/**
 * Process-global (module-singleton) registry, keyed first by `World` (each
 * `Scene` owns exactly one) and then by `componentName` — not by the
 * `ComponentDef` object's identity. Scoping storage per-world, rather than
 * sharing one array across every `Scene` that ever existed, matters because
 * entity ids are only unique *within* a world: two different `Scene`
 * instances both hand out entity id 1, and a single global array indexed by
 * that raw id would let an unrelated scene's "Position" write alias another
 * scene's entity. Scoping the *name → storage* mapping per world still
 * gives hot-reload the guarantee it needs: a re-evaluated module's new
 * `ComponentDef` object for "Position" resolves to the *same* underlying
 * bitECS storage as the previous version, for as long as that world (i.e.
 * that running scene) is still alive.
 */
class ComponentRegistry {
  private readonly _byWorld = new WeakMap<
    World,
    Map<string, RegisteredComponent>
  >();

  /**
   * Ensure `def` has a stable, name-keyed storage object for `world`, and
   * that storage is registered with bitECS against `world`. Safe to call
   * every frame — both the name lookup and the per-world registration are
   * idempotent.
   */
  ensure<T extends SerializableRecord>(
    world: World,
    def: ComponentDef<T>,
  ): Record<string, unknown[]> {
    let byName = this._byWorld.get(world);
    if (byName === undefined) {
      byName = new Map();
      this._byWorld.set(world, byName);
    }

    let entry = byName.get(def.componentName);

    if (entry === undefined) {
      const defaults = def.createDefaults();
      const sampleFields = Object.keys(defaults);
      const store: Record<string, unknown[]> = {};
      for (const field of sampleFields) store[field] = [];
      entry = {
        componentName: def.componentName,
        store,
        lastDef: def,
        fieldTypes: fieldTypesOf(defaults),
      };
      byName.set(def.componentName, entry);
      bitecsRegisterComponent(world, entry.store);
      return entry.store;
    }

    // Fast path: the exact same def object as last time (the ordinary case
    // — a module-level `const` def read every frame). No hot-swap can have
    // happened, so skip diffing entirely.
    if (entry.lastDef === def) return entry.store;

    // A different object arrived under the same `componentName` — this
    // only happens via a re-evaluated `defineComponent(...)` call, i.e. a
    // hot-swap (§23.1). Diff its *declared* shape against the last one
    // registered; see `fieldTypes`'s doc for why this compares declared
    // defaults, not live entity data.
    const newDefaults = def.createDefaults();
    const newFieldTypes = fieldTypesOf(newDefaults);
    const oldFields = Object.keys(entry.fieldTypes);
    const newFields = Object.keys(newFieldTypes);
    const shapeChanged =
      oldFields.length !== newFields.length ||
      !oldFields.every(
        (field) => entry.fieldTypes[field] === newFieldTypes[field],
      );

    entry.lastDef = def;
    entry.fieldTypes = newFieldTypes;

    if (shapeChanged) {
      // Find every entity *currently on this world* carrying this
      // component before touching the store's arrays — bitECS tracks
      // membership against the store object's identity, which we keep
      // stable below, so this query is unaffected by the field churn that
      // follows.
      const affected = query(world, [entry.store] as never) as number[];

      for (const field of oldFields) {
        if (!(field in newFieldTypes)) delete entry.store[field];
      }
      for (const field of newFields) {
        if (!(field in entry.store)) entry.store[field] = [];
      }

      if (affected.length > 0) {
        const defaultValues = newDefaults as Record<string, unknown>;
        for (const eid of affected) {
          for (const field of newFields) {
            const arr = entry.store[field];
            if (arr !== undefined) arr[eid] = defaultValues[field];
          }
        }
      }

      console.warn(
        `[ComponentRegistry] "${def.componentName}"'s shape changed (${describeShapeChange(oldFields, newFields)}) — reloading ${affected.length} ${affected.length === 1 ? "entity" : "entities"} that use it.`,
      );
    } else {
      // No shape change — just tolerate a def whose defaults key order
      // differs by ensuring every current field still has an array. This is
      // the pre-existing, non-shape-changing hot-swap path: code changes
      // without a field add/remove/type-change never reset entity data
      // (§13.3's default).
      for (const field of newFields) {
        if (!(field in entry.store)) entry.store[field] = [];
      }
    }

    return entry.store;
  }

  /** Test/dev hook: forget every world's registered components. */
  clearAll(): void {
    // WeakMap has no clear(); scopes are per-world already and worlds are
    // garbage-collected once their Scene is dropped, so there is nothing
    // that needs explicit clearing in normal operation. Kept for symmetry
    // and documentation.
  }
}

/**
 * Snapshots `typeof` for every field of a def's declared defaults. Used to
 * detect a shape change (field added/removed, or its default's type
 * changed) without ever looking at live entity data — see `fieldTypes`'s
 * doc on `RegisteredComponent` for why that distinction matters.
 */
function fieldTypesOf(defaults: SerializableRecord): Record<string, string> {
  const types: Record<string, string> = {};
  for (const [field, value] of Object.entries(defaults)) {
    types[field] = typeof value;
  }
  return types;
}

/** Builds the "added X, removed Y" fragment of the shape-change log message. */
function describeShapeChange(oldFields: string[], newFields: string[]): string {
  const added = newFields.filter((f) => !oldFields.includes(f));
  const removed = oldFields.filter((f) => !newFields.includes(f));
  const parts: string[] = [];
  if (added.length > 0) parts.push(`added ${added.join(", ")}`);
  if (removed.length > 0) parts.push(`removed ${removed.join(", ")}`);
  if (parts.length === 0) parts.push("field type changed");
  return parts.join(", ");
}

/** Single process-wide instance — see the class doc for the per-world scoping. */
export const componentRegistry = new ComponentRegistry();

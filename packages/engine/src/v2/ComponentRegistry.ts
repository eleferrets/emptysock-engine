import { registerComponent as bitecsRegisterComponent } from "bitecs";
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
    const sampleFields = Object.keys(def.createDefaults());

    if (entry === undefined) {
      const store: Record<string, unknown[]> = {};
      for (const field of sampleFields) store[field] = [];
      entry = { componentName: def.componentName, store };
      byName.set(def.componentName, entry);
      bitecsRegisterComponent(world, entry.store);
    } else {
      // Hot-reload: the def's shape may have grown a field since the store
      // was created. Add any new arrays in place — this keeps the *same*
      // store object (and therefore the same bitECS component reference)
      // while tolerating an added field (ENGINE_DESIGN.md §13.3: a field
      // add/remove is a "component shape change", handled by
      // HotReloadSystem at a higher layer; here we just avoid crashing on
      // lookup).
      for (const field of sampleFields) {
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

/** Single process-wide instance — see the class doc for the per-world scoping. */
export const componentRegistry = new ComponentRegistry();

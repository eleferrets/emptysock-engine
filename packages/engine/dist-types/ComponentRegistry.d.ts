import type { World } from "bitecs";
import type { ComponentDef } from "./Component.js";
import type { SerializableRecord } from "./Serializable.js";
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
declare class ComponentRegistry {
  private readonly _byWorld;
  /**
   * Ensure `def` has a stable, name-keyed storage object for `world`, and
   * that storage is registered with bitECS against `world`. Safe to call
   * every frame — both the name lookup and the per-world registration are
   * idempotent.
   */
  ensure<T extends SerializableRecord>(
    world: World,
    def: ComponentDef<T>,
  ): Record<string, unknown[]>;
  /**
   * Every `ComponentDef` currently registered on `world` — i.e. every
   * component name at least one live `ensure()` call has touched for this
   * world, in registration order. This is what makes a truly
   * component-agnostic live Inspector bridge possible: `QueryChannel`
   * doesn't have to be told in advance which components a given game
   * uses (`registerComponents(Transform, Sprite, ...)`) — it can instead
   * ask the registry directly, once at least one entity has actually used
   * each component. A world nothing has been spawned/added to yet
   * legitimately returns `[]`, not an error.
   */
  registeredComponents(world: World): ComponentDef[];
  /** Test/dev hook: forget every world's registered components. */
  clearAll(): void;
}
/** Single process-wide instance — see the class doc for the per-world scoping. */
export declare const componentRegistry: ComponentRegistry;
export {};
//# sourceMappingURL=ComponentRegistry.d.ts.map

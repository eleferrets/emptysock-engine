import type { ComponentDef } from "./Component.js";
import type { SerializableRecord } from "./Serializable.js";
/**
 * ENGINE_DESIGN.md §11.2 — "flat scenes, composable prefabs (prefabs can
 * contain prefabs)". A `Prefab` is a named template: a list of components
 * (by registered name, with prop overrides applied over that component's
 * own defaults) plus, optionally, other prefabs to flatten in first. There
 * is no live parent/child scene graph anywhere here — `scene.spawn(prefab)`
 * flattens the whole tree onto a single new entity at spawn time, matching
 * Bevy's "Bundle" pattern rather than Godot/Unity's nested-scene instancing.
 *
 * A prefab entry's `overrides` must satisfy the same `Serializable`
 * constraint every component field already does (`ecs/Serializable.ts`) —
 * prefab/scene JSON files are exactly the data that constraint exists for
 * (ENGINE_DESIGN.md §12.1), so a prop override can never smuggle in a
 * function or class instance a JSON file could never have represented
 * anyway.
 */
export interface PrefabComponentEntry<
  T extends SerializableRecord = SerializableRecord,
> {
  readonly def: ComponentDef<T>;
  readonly overrides?: Partial<T>;
}
export interface PrefabDef<T extends SerializableRecord = SerializableRecord> {
  readonly prefabName: string;
  readonly components: readonly PrefabComponentEntry[];
  /** Other prefabs to flatten onto the same entity before `components` apply. */
  readonly extends?: readonly PrefabDef[];
}
/**
 * Define a prefab. Nested prefabs (`extends`) are flattened at *spawn* time,
 * not here — `definePrefab` just records the template. Pass an explicit type
 * parameter to get typed `props` at hand-authored call sites too:
 * `definePrefab<{ x: number }>("Enemy", [...])`.
 *
 * ```ts
 * const Physical = definePrefab("Physical", [{ def: Transform }, { def: PhysicsBody }]);
 * const Enemy = definePrefab("Enemy", [{ def: Health, overrides: { max: 50 } }], { extends: [Physical] });
 * scene.spawn(Enemy, { x: 100 }); // Transform + PhysicsBody + Health, all on one entity
 * ```
 */
export declare function definePrefab<
  T extends SerializableRecord = SerializableRecord,
>(
  prefabName: string,
  components: readonly PrefabComponentEntry[],
  options?: {
    extends?: readonly PrefabDef[];
  },
): PrefabDef<T>;
/**
 * Flattens a prefab (and everything it `extends`, recursively, depth-first)
 * into a single ordered list of component entries. Later entries win on a
 * `componentName` collision — a prefab's own `components` override anything
 * a nested/extended prefab already set for the same component, which is
 * what lets `Enemy` in the example above layer specific data over a shared
 * `Physical` base.
 */
export declare function flattenPrefab(
  prefab: PrefabDef,
): PrefabComponentEntry[];
/**
 * Recursively lists the component defs a prefab (including everything it
 * extends) touches, deduplicated by name. Used by the `.d.ts` codegen
 * (`packages/toolchain/src/prefabCodegen.ts`) to know which registered
 * component fields make up a prefab's spawn-prop shape, without needing a
 * live `World` — codegen runs offline, against `ComponentDef`s alone.
 */
export declare function prefabComponentDefs(prefab: PrefabDef): ComponentDef[];

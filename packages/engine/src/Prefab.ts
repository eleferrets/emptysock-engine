import type { ComponentDef } from "./Component.js";
import type { Serializable, SerializableRecord } from "./Serializable.js";

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
  /**
   * @internal Type-only marker, never actually assigned — it exists purely
   * so `Scene.spawn<T>(prefab: PrefabDef<T>, props?: Partial<T>)` can infer
   * `T` (the prefab's merged prop shape) from whichever `PrefabDef<T>` value
   * is passed. `definePrefab` leaves this generic at its
   * `SerializableRecord` default; the `.d.ts` codegen
   * (`packages/toolchain/src/prefabCodegen.ts`) is what emits a
   * concretely-typed `declare const SomePrefab: PrefabDef<{ x: number; ... }>`
   * for a JSON-authored prefab, which is what actually drives autocomplete
   * on `scene.spawn(SomePrefab, props)` per ENGINE_DESIGN.md §13.4.
   */
  readonly __props?: T;
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
export function definePrefab<T extends SerializableRecord = SerializableRecord>(
  prefabName: string,
  components: readonly PrefabComponentEntry[],
  options: { extends?: readonly PrefabDef[] } = {},
): PrefabDef<T> {
  return options.extends === undefined
    ? { prefabName, components }
    : { prefabName, components, extends: options.extends };
}

/**
 * Flattens a prefab (and everything it `extends`, recursively, depth-first)
 * into a single ordered list of component entries. Later entries win on a
 * `componentName` collision — a prefab's own `components` override anything
 * a nested/extended prefab already set for the same component, which is
 * what lets `Enemy` in the example above layer specific data over a shared
 * `Physical` base.
 */
export function flattenPrefab(prefab: PrefabDef): PrefabComponentEntry[] {
  const byName = new Map<string, PrefabComponentEntry>();

  const visit = (p: PrefabDef): void => {
    for (const parent of p.extends ?? []) visit(parent);
    for (const entry of p.components) {
      const existing = byName.get(entry.def.componentName);
      const mergedOverrides =
        existing?.overrides !== undefined || entry.overrides !== undefined
          ? { ...existing?.overrides, ...entry.overrides }
          : undefined;
      byName.set(
        entry.def.componentName,
        mergedOverrides === undefined
          ? { def: entry.def }
          : { def: entry.def, overrides: mergedOverrides },
      );
    }
  };
  visit(prefab);

  return [...byName.values()];
}

/**
 * Recursively lists the component defs a prefab (including everything it
 * extends) touches, deduplicated by name. Used by the `.d.ts` codegen
 * (`packages/toolchain/src/prefabCodegen.ts`) to know which registered
 * component fields make up a prefab's spawn-prop shape, without needing a
 * live `World` — codegen runs offline, against `ComponentDef`s alone.
 */
export function prefabComponentDefs(prefab: PrefabDef): ComponentDef[] {
  return flattenPrefab(prefab).map((entry) => entry.def);
}

/** @internal — used by `Scene.spawn` to validate overrides before touching bitECS. */
export function assertSerializableOverrides(
  componentName: string,
  overrides: Partial<SerializableRecord> | undefined,
): void {
  if (overrides === undefined) return;
  for (const [field, value] of Object.entries(overrides)) {
    if (!isSerializable(value)) {
      throw new Error(
        `Prefab override "${componentName}.${field}" is not serializable (functions and class instances are not allowed in prefab/scene data).`,
      );
    }
  }
}

function isSerializable(value: unknown): value is Serializable {
  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (Array.isArray(value)) return value.every(isSerializable);
  if (typeof value === "object") {
    if (value.constructor !== Object) {
      return false;
    }
    return Object.values(value as Record<string, unknown>).every(
      isSerializable,
    );
  }
  return false;
}

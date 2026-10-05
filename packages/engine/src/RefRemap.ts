import type { ComponentDef } from "./Component.js";
import type { Entity } from "./Entity.js";
import { NO_REF, type EntityRef } from "./EntityRef.js";
import type { Scene } from "./Scene.js";

/**
 * Old-identity to new-entity lookup, the input to the shared two-phase remap
 * (docs/research/06-cross-entity-relationships.md 3.4): phase 1 spawns every
 * entity while recording `oldId -> Entity`; phase 2 (`remapRefs` /
 * `remapValue`) rewrites references through this map once all entities
 * exist. `oldId` is a number for save blobs and room carry-over (old
 * `EntityId`s) and a string for scene files (`SceneEntity.id`).
 */
export interface EntityIdMap {
  get(oldId: number | string): Entity | undefined;
}

export interface RemapOptions {
  /** Called for a ref whose old id has no entry. Default: `console.warn`. */
  readonly onMissing?: (oldId: number | string, where: string) => void;
}

function defaultMissing(oldId: number | string, where: string): void {
  console.warn(
    `[RefRemap] ${where}: reference to unknown entity ${String(oldId)} - cleared.`,
  );
}

/** `{ $ref: number | string }` as found in saves (number) and files (string). */
function refId(v: unknown): number | string | undefined {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return undefined;
  const id = (v as { $ref?: unknown }).$ref;
  return typeof id === "number" || typeof id === "string" ? id : undefined;
}

/** Component field names declared `entityRef` in `def.schema`. */
export function entityRefFields(def: ComponentDef): string[] {
  const schema = def.schema as
    Record<string, { kind: string } | undefined> | undefined;
  if (schema === undefined) return [];
  return Object.keys(schema).filter((k) => schema[k]?.kind === "entityRef");
}

/**
 * Phase 2 for declared fields: for every entity in `entities` and every
 * component in `defs` it carries, rewrites each `entityRef`-schema field's
 * `$ref` from its old id to the fresh `scene.idOf` of the mapped entity. A
 * ref with no mapping (or an empty one) becomes `NO_REF`; a non-empty
 * missing one also reports through `onMissing`.
 */
export function remapRefs(
  scene: Scene,
  entities: Iterable<Entity>,
  map: EntityIdMap,
  defs: readonly ComponentDef[],
  options: RemapOptions = {},
): void {
  const onMissing = options.onMissing ?? defaultMissing;
  const withRefs = defs
    .map((def) => ({ def, fields: entityRefFields(def) }))
    .filter((d) => d.fields.length > 0);
  if (withRefs.length === 0) return;
  for (const entity of entities) {
    for (const { def, fields } of withRefs) {
      const comp = entity.get(def) as Record<string, unknown> | undefined;
      if (comp === undefined) continue;
      for (const field of fields) {
        const id = refId(comp[field]);
        if (id === undefined) continue;
        if (id === 0 || id === "") {
          comp[field] = NO_REF;
          continue;
        }
        const target = map.get(id);
        if (target === undefined) {
          onMissing(id, `${def.componentName}.${field}`);
          comp[field] = NO_REF;
        } else {
          comp[field] = scene.refTo(target);
        }
      }
    }
  }
}

/** Decides whether `v` is a leaf reference; returns its replacement, or `undefined` to keep walking. */
export type RemapLeaf = (v: unknown) => { readonly value: unknown } | undefined;

/** Leaf handler for `EntityRef`-shaped values (`{ $ref }`), for use with `remapValue`. */
export function entityRefLeaf(
  scene: Scene,
  map: EntityIdMap,
  options: RemapOptions = {},
  where = "value",
): RemapLeaf {
  const onMissing = options.onMissing ?? defaultMissing;
  return (v) => {
    const id = refId(v);
    if (id === undefined) return undefined;
    if (id === 0 || id === "") return { value: NO_REF };
    const target = map.get(id);
    if (target === undefined) {
      onMissing(id, where);
      return { value: NO_REF };
    }
    return { value: scene.refTo(target) as EntityRef };
  };
}

const MAX_DEPTH = 8;

function isPlain(v: object): boolean {
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/**
 * Walks `value` (arrays and plain objects, to a fixed depth of 8, with a
 * visited set so cycles are safe), replacing every leaf `leaf` claims.
 * Containers are mutated in place; the (possibly replaced) top-level value is
 * returned. Class instances that `leaf` does not claim are left alone. Used
 * for untyped payloads such as per-instance variables, where no schema says
 * which fields hold references.
 */
export function remapValue(
  value: unknown,
  leaf: RemapLeaf,
  maxDepth = MAX_DEPTH,
  visited: Set<object> = new Set(),
): unknown {
  const hit = leaf(value);
  if (hit !== undefined) return hit.value;
  if (typeof value !== "object" || value === null || maxDepth <= 0) {
    return value;
  }
  if (visited.has(value) || Object.isFrozen(value)) return value;
  if (!Array.isArray(value) && !isPlain(value)) return value;
  visited.add(value);
  const bag = value as Record<string | number, unknown>;
  for (const key of Object.keys(bag)) {
    bag[key] = remapValue(bag[key], leaf, maxDepth - 1, visited);
  }
  return value;
}

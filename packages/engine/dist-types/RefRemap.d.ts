import type { ComponentDef } from "./Component.js";
import type { Entity } from "./Entity.js";
import type { Scene } from "./Scene.js";
/**
 * Old-identity to new-entity lookup, the input to the shared two-phase remap
 *: phase 1 spawns every
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
/** Component field names declared `entityRef` in `def.schema`. */
export declare function entityRefFields(def: ComponentDef): string[];
/**
 * Phase 2 for declared fields: for every entity in `entities` and every
 * component in `defs` it carries, rewrites each `entityRef`-schema field's
 * `$ref` from its old id to the fresh `scene.idOf` of the mapped entity. A
 * ref with no mapping (or an empty one) becomes `NO_REF`; a non-empty
 * missing one also reports through `onMissing`.
 */
export declare function remapRefs(
  scene: Scene,
  entities: Iterable<Entity>,
  map: EntityIdMap,
  defs: readonly ComponentDef[],
  options?: RemapOptions,
): void;
/** Decides whether `v` is a leaf reference; returns its replacement, or `undefined` to keep walking. */
export type RemapLeaf = (v: unknown) =>
  | {
      readonly value: unknown;
    }
  | undefined;
/** Leaf handler for `EntityRef`-shaped values (`{ $ref }`), for use with `remapValue`. */
export declare function entityRefLeaf(
  scene: Scene,
  map: EntityIdMap,
  options?: RemapOptions,
  where?: string,
): RemapLeaf;
/**
 * Walks `value` (arrays and plain objects, to a fixed depth of 8, with a
 * visited set so cycles are safe), replacing every leaf `leaf` claims.
 * Containers are mutated in place; the (possibly replaced) top-level value is
 * returned. Class instances that `leaf` does not claim are left alone. Used
 * for untyped payloads such as per-instance variables, where no schema says
 * which fields hold references.
 */
export declare function remapValue(
  value: unknown,
  leaf: RemapLeaf,
  maxDepth?: number,
  visited?: Set<object>,
): unknown;

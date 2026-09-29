/**
 * What happens to a subject when the target of one of its edges is
 * destroyed (docs/research/06-cross-entity-relationships.md 3.3).
 *
 * - `"remove"`: only the edge is dropped; the subject lives on.
 * - `"destroy"`: the subject is destroyed too, through `Scene.destroy`, so
 *   its side tables, pool return and own relations are cleaned up.
 *
 * bitECS always drops a pair when its target dies; the cascade is done by
 * the engine rather than bitECS's `withAutoRemoveSubject`, because that
 * modifier removes the subject with the raw bitECS `removeEntity`, bypassing
 * `Scene.destroy` (the engine's per-entity side tables would leak).
 */
export type TargetDestroyedPolicy = "remove" | "destroy";
/** A named, typed edge kind between entities of one scene. */
export interface RelationDef {
  readonly name: string;
  readonly onTargetDestroyed: TargetDestroyedPolicy;
  /** A subject holds at most one target; relating again replaces it. */
  readonly exclusive: boolean;
  /** Reject edges that would make the graph cyclic (parent/child style). */
  readonly acyclic: boolean;
}
export interface DefineRelationOptions {
  /** Default `"remove"`. */
  readonly onTargetDestroyed?: TargetDestroyedPolicy;
  /** Default `false`. */
  readonly exclusive?: boolean;
  /** Default `false`. */
  readonly acyclic?: boolean;
}
export declare function defineRelation(
  name: string,
  options?: DefineRelationOptions,
): RelationDef;
/**
 * Built-in hierarchy edge: exclusive (one parent), acyclic, and destroying
 * a parent destroys its children. Opt-in: nothing applies it implicitly.
 */
export declare const ChildOf: RelationDef;

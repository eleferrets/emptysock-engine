/**
 * Stable, serialisable reference to an entity within one `Scene`
 * (docs/research/06-cross-entity-relationships.md section 3.1).
 *
 * A plain object so it satisfies `Serializable` and survives a JSON round
 * trip. `$ref` is a per-scene `EntityId`: a monotonic counter that is never
 * reused, unlike the bitECS eid (recycled) or `Entity.rawId` (version bits
 * stripped). `0` means "no reference". Resolve with `scene.resolve(ref)`.
 */
export type EntityRef = {
  readonly $ref: number;
};
/** Per-scene monotonic entity id. Never reused within a scene; 0 = none. */
export type EntityId = number;
/** The "points at nothing" reference. */
export declare const NO_REF: EntityRef;
/** `true` for `{ $ref: <number> }` (runtime form; file form uses string ids). */
export declare function isEntityRef(v: unknown): v is EntityRef;

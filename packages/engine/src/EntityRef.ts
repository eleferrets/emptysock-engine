import type { World } from "bitecs";
import type { Entity } from "./Entity.js";

/**
 * Stable, serialisable reference to an entity within one `Scene`
 * (docs/research/06-cross-entity-relationships.md section 3.1).
 *
 * A plain object so it satisfies `Serializable` and survives a JSON round
 * trip. `$ref` is a per-scene `EntityId`: a monotonic counter that is never
 * reused, unlike the bitECS eid (recycled) or `Entity.rawId` (version bits
 * stripped). `0` means "no reference". Resolve with `scene.resolve(ref)`.
 */
export type EntityRef = { readonly $ref: number };

/** Per-scene monotonic entity id. Never reused within a scene; 0 = none. */
export type EntityId = number;

/** The "points at nothing" reference. */
export const NO_REF: EntityRef = Object.freeze({ $ref: 0 });

/** `true` for `{ $ref: <number> }` (runtime form; file form uses string ids). */
export function isEntityRef(v: unknown): v is EntityRef {
  return (
    typeof v === "object" &&
    v !== null &&
    !Array.isArray(v) &&
    typeof (v as { $ref?: unknown }).$ref === "number"
  );
}

/**
 * Per-world id table backing `Scene.idOf/resolve` and `Entity.ref()`. Ids are
 * assigned lazily on first `idOf`, so entities nobody references cost
 * nothing. A destroyed entity (pooled or not) drops its mapping, which is
 * what makes `resolve` return `undefined` for pooled entities that still
 * report `isAlive`.
 *
 * @internal
 */
export class EntityIdTable {
  private _next = 1;
  private readonly _byEid = new Map<number, EntityId>();
  private readonly _byId = new Map<EntityId, Entity>();

  idOf(entity: Entity): EntityId {
    let id = this._byEid.get(entity.eid);
    if (id === undefined) {
      id = this._next++;
      this._byEid.set(entity.eid, id);
      this._byId.set(id, entity);
    }
    return id;
  }

  /** Live entity for `id`, or `undefined` if dropped/never assigned. */
  get(id: EntityId): Entity | undefined {
    const e = this._byId.get(id);
    return e !== undefined && e.isAlive ? e : undefined;
  }

  /** Forget the entity's id (called from `Scene.destroy`). */
  drop(eid: number): void {
    const id = this._byEid.get(eid);
    if (id === undefined) return;
    this._byEid.delete(eid);
    this._byId.delete(id);
  }

  /** How many entities currently hold an id. */
  get size(): number {
    return this._byEid.size;
  }
}

const _tables = new WeakMap<World, EntityIdTable>();

/** @internal Get (creating) the id table for a world. */
export function entityIdTable(world: World): EntityIdTable {
  let t = _tables.get(world);
  if (t === undefined) {
    t = new EntityIdTable();
    _tables.set(world, t);
  }
  return t;
}

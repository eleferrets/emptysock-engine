import {
  addComponent,
  createRelation,
  entityExists,
  makeExclusive,
  removeComponent,
} from "bitecs";
import type { Relation, World } from "bitecs";
import type { Entity } from "./Entity.js";

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
  /** @internal the backing bitECS relation. */
  readonly relation: Relation<unknown>;
}

export interface DefineRelationOptions {
  /** Default `"remove"`. */
  readonly onTargetDestroyed?: TargetDestroyedPolicy;
  /** Default `false`. */
  readonly exclusive?: boolean;
  /** Default `false`. */
  readonly acyclic?: boolean;
}

export function defineRelation(
  name: string,
  options: DefineRelationOptions = {},
): RelationDef {
  const exclusive = options.exclusive ?? false;
  const relation = exclusive ? createRelation(makeExclusive) : createRelation();
  return {
    name,
    onTargetDestroyed: options.onTargetDestroyed ?? "remove",
    exclusive,
    acyclic: options.acyclic ?? false,
    relation,
  };
}

/**
 * Built-in hierarchy edge: exclusive (one parent), acyclic, and destroying
 * a parent destroys its children. Opt-in: nothing applies it implicitly.
 */
export const ChildOf: RelationDef = defineRelation("ChildOf", {
  onTargetDestroyed: "destroy",
  exclusive: true,
  acyclic: true,
});

/**
 * Per-scene relation bookkeeping. Edges are stored as bitECS pair
 * components (so bitECS queries and `Hierarchy()` work on them) plus a
 * forward/reverse index here, giving O(subjects) reverse lookups without
 * creating a bitECS query per target.
 *
 * @internal
 */
export class RelationStore {
  private readonly _fwd = new Map<RelationDef, Map<number, Set<number>>>();
  private readonly _rev = new Map<RelationDef, Map<number, Set<number>>>();
  /** Insertion-ordered so cascade order is deterministic. */
  private readonly _used = new Set<RelationDef>();

  constructor(
    private readonly _world: World,
    private readonly _makeEntity: (eid: number) => Entity,
    private readonly _destroy: (e: Entity) => void,
  ) {}

  /** `true` once any edge was ever created (cheap gate for destroy). */
  get active(): boolean {
    return this._used.size > 0;
  }

  relate(subject: Entity, def: RelationDef, target: Entity): void {
    if (!subject.isAlive || !target.isAlive) {
      throw new Error(
        `Scene.relate("${def.name}"): subject and target must both be alive.`,
      );
    }
    if (subject.eid === target.eid) {
      throw new Error(
        `Scene.relate("${def.name}"): an entity cannot relate to itself.`,
      );
    }
    if (def.acyclic && this._reaches(def, target.eid, subject.eid)) {
      throw new Error(`Scene.relate("${def.name}"): would create a cycle.`);
    }
    const existing = this._fwd.get(def)?.get(subject.eid);
    if (existing?.has(target.eid) === true) return;
    if (def.exclusive) this.unrelate(subject, def);
    this._used.add(def);
    addComponent(this._world, subject.eid, def.relation(target.eid));
    add(this._fwd, def, subject.eid, target.eid);
    add(this._rev, def, target.eid, subject.eid);
  }

  /** Remove one edge (`target` given) or all of `subject`'s edges of `def`. */
  unrelate(subject: Entity, def: RelationDef, target?: Entity): void {
    const targets = this._fwd.get(def)?.get(subject.eid);
    if (targets === undefined) return;
    const victims = target === undefined ? [...targets] : [target.eid];
    for (const t of victims) {
      if (!targets.has(t)) continue;
      if (
        entityExists(this._world, subject.eid) &&
        entityExists(this._world, t)
      ) {
        removeComponent(this._world, subject.eid, def.relation(t));
      }
      del(this._fwd, def, subject.eid, t);
      del(this._rev, def, t, subject.eid);
    }
  }

  targetsOf(subject: Entity, def: RelationDef): Entity[] {
    const set = this._fwd.get(def)?.get(subject.eid);
    return set === undefined ? [] : [...set].map(this._makeEntity);
  }

  subjectsOf(target: Entity, def: RelationDef): Entity[] {
    const set = this._rev.get(def)?.get(target.eid);
    return set === undefined ? [] : [...set].map(this._makeEntity);
  }

  /**
   * Called by `Scene.destroy` before the entity is torn down: applies each
   * relation's policy to the entity's subjects, then drops its own edges.
   */
  onDestroyed(entity: Entity): void {
    for (const def of this._used) {
      const subjects = this.subjectsOf(entity, def);
      for (const s of subjects) {
        if (def.onTargetDestroyed === "destroy") {
          this._destroy(s); // unrelates itself via its own onDestroyed
        } else {
          this.unrelate(s, def, entity);
        }
      }
      this.unrelate(entity, def);
      this._rev.get(def)?.delete(entity.eid);
    }
  }

  private _reaches(def: RelationDef, from: number, goal: number): boolean {
    const seen = new Set<number>();
    const stack = [from];
    while (stack.length > 0) {
      const cur = stack.pop() as number;
      if (cur === goal) return true;
      if (seen.has(cur)) continue;
      seen.add(cur);
      const next = this._fwd.get(def)?.get(cur);
      if (next !== undefined) stack.push(...next);
    }
    return false;
  }
}

type Index = Map<RelationDef, Map<number, Set<number>>>;

function add(idx: Index, def: RelationDef, a: number, b: number): void {
  let m = idx.get(def);
  if (m === undefined) idx.set(def, (m = new Map()));
  let s = m.get(a);
  if (s === undefined) m.set(a, (s = new Set()));
  s.add(b);
}

function del(idx: Index, def: RelationDef, a: number, b: number): void {
  const m = idx.get(def);
  const s = m?.get(a);
  if (s === undefined) return;
  s.delete(b);
  if (s.size === 0) m?.delete(a);
}

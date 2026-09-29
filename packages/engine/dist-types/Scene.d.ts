import type { ComponentDef } from "./Component.js";
import { Entity } from "./Entity.js";
import { type EntityId, type EntityRef } from "./EntityRef.js";
import { type PrefabDef } from "./Prefab.js";
import type { SerializableRecord } from "./Serializable.js";
/**
 * A `scene.each(...)` callback receives one live component object per
 * component argument, plus the `Entity` handle last. Unlike `entity.get()`,
 * these are read directly off bitECS's raw arrays for the frame's iteration
 * — no proxy allocation (ENGINE_DESIGN.md §21: "measurably faster because it
 * skips proxy overhead altogether"). Mutate them in place; the write lands
 * straight in the underlying array.
 */
type EachCallback<T extends readonly ComponentDef[]> = (
  ...args: [
    ...{
      [K in keyof T]: T[K] extends ComponentDef<infer U> ? U : never;
    },
    Entity,
  ]
) => void;
/**
 * ENGINE_DESIGN.md §3/§16.1/§21 — the ECS world for one running scene. A
 * `Scene` owns exactly one bitECS `World`, with versioned entity IDs enabled
 * by default (§23) so a stale `Entity` handle can never silently alias a
 * different, newly-spawned entity.
 *
 * This class is deliberately narrow — spawn/destroy/each and nothing about
 * physics, actors, or rendering. `Game` (see `Game.ts`) is what wires those
 * systems to a `Scene`'s lifecycle; keeping them separate is what makes the
 * headless testing harness in `testing/index.ts` possible without dragging
 * in a renderer.
 */
/** Options for `scene.spawn(prefab, props, options)` — ENGINE_DESIGN.md §12.4. */
export interface SpawnOptions {
  /**
   * Fold pooling into spawn/destroy (§12.4). When `true`, `scene.destroy()`
   * on the returned entity returns it to an internal per-prefab pool
   * instead of truly deallocating it, and a later `spawn(SamePrefab, ...,
   * { pool: true })` reuses that entity slot (component data reset to the
   * prefab's defaults + the new overrides) instead of allocating a new one.
   * Game code never branches on which happened — `destroy()` is the same
   * call either way.
   */
  pool?: boolean;
}
export declare class Scene {
  private readonly _proxyCache;
  private readonly _liveEntities;
  /** Idle, pool-eligible entity ids, keyed by the prefab they were spawned from. */
  private readonly _pools;
  /** eid -> the prefab it was spawned from, only tracked for pooled spawns. */
  private readonly _pooledOrigin;
  constructor();
  /** Spawn a new, empty entity. Attach components with `entity.add(...)`. */
  spawn(name?: string): Entity;
  /**
   * Spawn a `Prefab` (ENGINE_DESIGN.md §11.2) as a unit onto one new entity
   * — every component the prefab declares, plus everything it `extends`
   * flattened in first. `props` is a flat, `Serializable` prop bag applied
   * on top of the prefab's own per-component defaults/overrides: a value
   * whose key matches a field name on one of the prefab's components
   * overrides that field (matching every component that happens to declare
   * a field with that name, e.g. `x`/`y` on any `Transform`-shaped
   * component in the prefab).
   */
  spawn<T extends SerializableRecord>(
    prefab: PrefabDef<T>,
    props?: Partial<T>,
    options?: SpawnOptions,
  ): Entity;
  /**
   * Destroy an entity. If it was spawned with `{ pool: true }` from a
   * prefab, this returns it to that prefab's pool instead of deallocating
   * it (§12.4) — its component data is stripped now and reset on reuse; the
   * caller sees the same call either way. Note one deliberate asymmetry: a
   * pooled entity's bitECS id is *not* released back to bitECS's own
   * recycling (`entity.isAlive` stays `true`) — that's what reserves the id
   * for this prefab's own pool instead of letting an unrelated `spawn()`
   * elsewhere claim it first. It has zero components after this call, so
   * `.get()` on any old handle simply returns `undefined` for everything,
   * same practical effect as "destroyed" for game code that isn't reaching
   * into the pool machinery itself. A non-pooled entity's handle (and any
   * other handle holding the same id) becomes stale immediately —
   * `entity.isAlive` reads `false` and `.get()`/`.add()` on it fail rather
   * than resolving onto whatever entity bitECS's id-recycling later hands
   * the freed slot to (§23).
   */
  destroy(entity: Entity): void;
  /**
   * Stable per-scene id for `entity`, assigned on first call (monotonic,
   * never reused within this scene). Throws for a destroyed entity or one
   * from another scene.
   */
  idOf(entity: Entity): EntityId;
  /** `EntityRef` for `entity` (see `idOf`). */
  refTo(entity: Entity): EntityRef;
  /**
   * The live entity `ref` points at, or `undefined` when it is `NO_REF`,
   * never existed, or was destroyed. A pooled-and-recycled entity counts as
   * destroyed: pooled destroy drops its id, so the ref does not alias the
   * entity's next occupant.
   */
  resolve(ref: EntityRef | null | undefined): Entity | undefined;
  /** Number of entities currently alive in this scene. */
  get entityCount(): number;
  /**
   * Bulk-iteration power path (ENGINE_DESIGN.md §11.3 — `each`, not
   * `query`). Bypasses the `.get()` proxy layer entirely: components are
   * read straight off bitECS's arrays, and `entity` is only constructed
   * (cheaply — it's a handle, not an allocation of game state) for the
   * cases that still need it, e.g. `scene.destroy(entity)` inside the loop.
   */
  each<T extends readonly ComponentDef[]>(
    ...args: [...T, EachCallback<T>]
  ): void;
  /** `true` if `entity` (still alive) carries every listed component. */
  hasAll(entity: Entity, ...defs: ComponentDef[]): boolean;
}
export {};

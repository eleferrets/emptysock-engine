import {
  addEntity,
  createEntityIndex,
  createWorld,
  hasComponent as bitecsHasComponent,
  query,
  removeEntity as bitecsRemoveEntity,
  withVersioning,
} from "bitecs";
import type { World } from "bitecs";
import type { ComponentDef } from "./Component.js";
import { componentRegistry } from "./ComponentRegistry.js";
import { Entity, type ProxyCache } from "./Entity.js";
import {
  assertSerializableOverrides,
  flattenPrefab,
  type PrefabDef,
} from "./Prefab.js";
import type { SerializableRecord } from "./Serializable.js";
import { clearPhysicsBody } from "./components/PhysicsBody.js";
import { clearCoroutines } from "./Coroutines.js";

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
    ...{ [K in keyof T]: T[K] extends ComponentDef<infer U> ? U : never },
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

export class Scene {
  /** @internal */
  readonly world: World;
  private readonly _proxyCache: ProxyCache = new Map();
  private readonly _liveEntities = new Set<number>();
  /** Idle, pool-eligible entity ids, keyed by the prefab they were spawned from. */
  private readonly _pools = new Map<string, number[]>();
  /** eid -> the prefab it was spawned from, only tracked for pooled spawns. */
  private readonly _pooledOrigin = new Map<number, PrefabDef>();

  constructor() {
    // §23: versioned entity IDs, enabled by default, not configurable off.
    this.world = createWorld(createEntityIndex(withVersioning()));
  }

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
  spawn(
    nameOrPrefab?: string | PrefabDef,
    props?: SerializableRecord,
    options?: SpawnOptions,
  ): Entity {
    if (nameOrPrefab === undefined || typeof nameOrPrefab === "string") {
      const eid = addEntity(this.world);
      this._liveEntities.add(eid);
      return new Entity(this.world, eid, this._proxyCache);
    }

    const prefab = nameOrPrefab;
    const pool = options?.pool ?? false;
    assertSerializableOverrides(prefab.prefabName, props);

    let eid: number;
    const idle = pool ? this._pools.get(prefab.prefabName) : undefined;
    if (idle !== undefined && idle.length > 0) {
      eid = idle.pop() as number;
    } else {
      eid = addEntity(this.world);
    }
    this._liveEntities.add(eid);
    const entity = new Entity(this.world, eid, this._proxyCache);
    if (pool) this._pooledOrigin.set(eid, prefab);

    const matchedPropFields = new Set<string>();
    for (const { def, overrides } of flattenPrefab(prefab)) {
      assertSerializableOverrides(def.componentName, overrides);
      const defaults = def.createDefaults();
      const propsForComponent: Record<string, unknown> = {};
      if (props !== undefined) {
        for (const [field, value] of Object.entries(props)) {
          if (field in defaults) {
            propsForComponent[field] = value;
            matchedPropFields.add(field);
          }
        }
      }
      entity.add(def, { ...overrides, ...propsForComponent } as never);
    }

    if (props !== undefined) {
      const unmatchedFields = Object.keys(props).filter(
        (field) => !matchedPropFields.has(field),
      );
      if (unmatchedFields.length > 0) {
        console.warn(
          `[Scene] spawn("${prefab.prefabName}"): prop(s) [${unmatchedFields.join(", ")}] did not match any field on this prefab's components — ignored. Check for a typo.`,
        );
      }
    }

    return entity;
  }

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
  destroy(entity: Entity): void {
    if (!entity.isAlive) return;
    const pooledFrom = this._pooledOrigin.get(entity.eid);
    this._liveEntities.delete(entity.eid);
    this._proxyCache.delete(entity.eid);
    // This is the one place that actually knows "this entity's component
    // data is being reset/removed", regardless of which component types
    // were attached — so it's also the right call site to clear
    // `PhysicsBody`'s side-table for this (world, eid) pair. Without this,
    // a pooled entity's stale collision callbacks and cached handle Proxy
    // would silently leak onto whatever new entity later reuses this same
    // bitECS id (pooled ids are deliberately never released back to
    // bitECS's own recycling — see `SpawnOptions.pool`'s doc comment).
    clearPhysicsBody(this.world, entity.eid);
    // Same reasoning as `clearPhysicsBody` above: a pooled entity's bitECS
    // id is never released back to bitECS's own recycling, so without this
    // a coroutine still scheduled against the previous occupant would keep
    // running against whatever new entity later reuses this id.
    clearCoroutines(this.world, entity.eid);

    if (pooledFrom !== undefined) {
      for (const { def } of flattenPrefab(pooledFrom)) {
        entity.remove(def);
      }
      let idle = this._pools.get(pooledFrom.prefabName);
      if (idle === undefined) {
        idle = [];
        this._pools.set(pooledFrom.prefabName, idle);
      }
      idle.push(entity.eid);
      return;
    }

    bitecsRemoveEntity(this.world, entity.eid);
  }

  /** Number of entities currently alive in this scene. */
  get entityCount(): number {
    return this._liveEntities.size;
  }

  /**
   * Bulk-iteration power path (ENGINE_DESIGN.md §11.3 — `each`, not
   * `query`). Bypasses the `.get()` proxy layer entirely: components are
   * read straight off bitECS's arrays, and `entity` is only constructed
   * (cheaply — it's a handle, not an allocation of game state) for the
   * cases that still need it, e.g. `scene.destroy(entity)` inside the loop.
   */
  each<T extends readonly ComponentDef[]>(
    ...args: [...T, EachCallback<T>]
  ): void {
    const callback = args[args.length - 1] as EachCallback<T>;
    const defs = args.slice(0, -1) as unknown as T;
    const stores = defs.map((def) => componentRegistry.ensure(this.world, def));
    const eids = query(this.world, stores as never);

    // One reusable "cursor" view per component, built with real
    // getters/setters (not a Proxy trap) bound to a shared mutable index —
    // zero per-entity allocation, and no Proxy indirection at all, matching
    // ENGINE_DESIGN.md §21's "bypasses the proxy layer entirely, iterates
    // the raw arrays directly" (this is the fast path `.get()`'s cached
    // per-entity Proxy exists to be faster than).
    const cursor = { i: 0 };
    const views = stores.map((store) => makeStoreCursor(store, cursor));

    for (const eid of eids) {
      cursor.i = eid;
      // A fresh `Entity` per iteration is cheap — it's a handle (world +
      // eid + a shared cache reference), not an allocation of game state —
      // and unlike reusing one mutable instance, it's safe for a callback
      // to stash the handle somewhere and use it after the loop ends.
      const entity = new Entity(this.world, eid, this._proxyCache);
      (callback as (...a: unknown[]) => void)(...views, entity);
    }
  }

  /** `true` if `entity` (still alive) carries every listed component. */
  hasAll(entity: Entity, ...defs: ComponentDef[]): boolean {
    if (!entity.isAlive) return false;
    return defs.every((def) =>
      bitecsHasComponent(
        this.world,
        entity.eid,
        componentRegistry.ensure(this.world, def),
      ),
    );
  }
}

/**
 * Builds one reusable, no-Proxy view onto a component's parallel arrays for
 * `scene.each` (ENGINE_DESIGN.md §21). Built once per `each()` call (not per
 * entity), it exposes one real accessor property per field, closing over
 * `cursor` — the caller advances `cursor.i` to the current entity id before
 * invoking the callback each iteration. No Proxy trap indirection, no
 * per-entity allocation: this is the actual "measurably faster" path §21
 * calls out `each` for.
 */
function makeStoreCursor<T extends SerializableRecord>(
  store: Record<string, unknown[]>,
  cursor: { i: number },
): T {
  const view = {} as Record<string, unknown>;
  for (const field of Object.keys(store)) {
    Object.defineProperty(view, field, {
      enumerable: true,
      get: () => store[field]?.[cursor.i],
      set: (value: unknown) => {
        let arr = store[field];
        if (arr === undefined) {
          arr = [];
          store[field] = arr;
        }
        arr[cursor.i] = value;
      },
    });
  }
  return view as T;
}

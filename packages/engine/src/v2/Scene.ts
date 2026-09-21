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
export class Scene {
  /** @internal */
  readonly world: World;
  private readonly _proxyCache: ProxyCache = new Map();
  private readonly _liveEntities = new Set<number>();

  constructor() {
    // §23: versioned entity IDs, enabled by default, not configurable off.
    this.world = createWorld(createEntityIndex(withVersioning()));
  }

  /** Spawn a new, empty entity. Attach components with `entity.add(...)`. */
  spawn(_name?: string): Entity {
    const eid = addEntity(this.world);
    this._liveEntities.add(eid);
    return new Entity(this.world, eid, this._proxyCache);
  }

  /**
   * Destroy an entity. Its handle (and any other handle holding the same
   * id) becomes stale immediately — `entity.isAlive` reads `false` and
   * `.get()`/`.add()` on it fail rather than resolving onto whatever entity
   * bitECS's id-recycling later hands the freed slot to (§23).
   */
  destroy(entity: Entity): void {
    if (!entity.isAlive) return;
    this._liveEntities.delete(entity.eid);
    this._proxyCache.delete(entity.eid);
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

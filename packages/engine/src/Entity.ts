import {
  $internal,
  addComponent as bitecsAddComponent,
  entityExists,
  hasComponent as bitecsHasComponent,
  removeComponent as bitecsRemoveComponent,
  getId,
} from "bitecs";
import type { World } from "bitecs";
import type { ComponentDef } from "./Component.js";
import { entityIdTable, type EntityRef } from "./EntityRef.js";
import { componentRegistry } from "./ComponentRegistry.js";
import {
  startCoroutine,
  stopCoroutine,
  type CoroutineFactory,
  type CoroutineHandle,
} from "./Coroutines.js";
import { setField, setFields } from "./internal/fields.js";
import type { SerializableRecord } from "./Serializable.js";

/** A plain `{x, y}` pair — used by `AStarSearch`/`NavMeshSystem` and any component needing a 2D point without pulling in a math library. */
export interface Vec2 {
  x: number;
  y: number;
}

/**
 * Builds the lazily-created, cached `Proxy` for one (entity, componentType)
 * pair (ENGINE_DESIGN.md §21). Every get/set on the returned proxy reads or
 * writes directly into the component's underlying per-field arrays at
 * `index` — no allocation happens on access, only once, here, when the
 * proxy itself is built.
 */
function createComponentProxy<T extends SerializableRecord>(
  store: Record<string, unknown[]>,
  index: number,
): T {
  return new Proxy({} as T, {
    get(_target, prop: string | symbol) {
      if (typeof prop !== "string") return undefined;
      const field = store[prop];
      return field === undefined ? undefined : field[index];
    },
    set(_target, prop: string | symbol, value: unknown) {
      if (typeof prop !== "string") return false;
      setField(store, prop, index, value);
      return true;
    },
    has(_target, prop: string | symbol) {
      return typeof prop === "string" && prop in store;
    },
    ownKeys(_target) {
      return Object.keys(store);
    },
    getOwnPropertyDescriptor(_target, prop) {
      if (typeof prop !== "string" || !(prop in store)) return undefined;
      return {
        enumerable: true,
        configurable: true,
        value: store[prop]?.[index],
      };
    },
  });
}

/** Per-scene proxy cache: full versioned eid -> componentName -> proxy. */
export type ProxyCache = Map<number, Map<string, unknown>>;

/**
 * A lightweight, cheap-to-copy handle onto a bitECS entity (ENGINE_DESIGN.md
 * §3). It carries no game state itself — state lives in the component
 * arrays `.get()` reaches into — only the bitECS world it belongs to and its
 * (already version-bit-encoded) entity id.
 *
 * Because bitECS's versioned entity IDs are enabled by default (§23), a
 * handle to a destroyed entity never silently resolves onto whatever entity
 * happens to reuse its slot: `entityExists` compares the *whole* id,
 * version bits included, so a stale handle fails `.get()`/`.add()` loudly
 * instead of aliasing.
 */
export class Entity {
  /** @internal */
  readonly world: World;
  /** @internal */
  readonly eid: number;
  /** @internal */
  private readonly _proxyCache: ProxyCache;

  /** @internal — constructed by `Scene.spawn`, never directly by game code. */
  constructor(world: World, eid: number, proxyCache: ProxyCache) {
    this.world = world;
    this.eid = eid;
    this._proxyCache = proxyCache;
  }

  /** Raw numeric id, version bits stripped — mainly useful for logging. */
  get rawId(): number {
    const ctx = (
      this.world as unknown as Record<
        typeof $internal,
        { entityIndex: Parameters<typeof getId>[0] }
      >
    )[$internal];
    return getId(ctx.entityIndex, this.eid);
  }

  /**
   * Stable serialisable reference to this entity (assigns a per-scene id on
   * first call). Throws on a destroyed entity. See `EntityRef`.
   */
  ref(): EntityRef {
    if (!this.isAlive) {
      throw new Error("Entity.ref() called on a destroyed entity.");
    }
    return { $ref: entityIdTable(this.world).idOf(this) };
  }

  /**
   * `false` once this entity (or the slot it used to occupy) has been
   * destroyed and, for a stale handle, recycled — bitECS's versioned ids
   * make this comparison exact rather than "probably still valid".
   */
  get isAlive(): boolean {
    return entityExists(this.world, this.eid);
  }

  /**
   * Add a component to this entity. Throws on a stale/destroyed handle
   * (mutating something that no longer exists is a bug, not a no-op) and
   * throws if the component is already present — "one shot" semantics.
   */
  add<T extends SerializableRecord>(
    def: ComponentDef<T>,
    overrides?: Partial<T>,
  ): T {
    if (!this.isAlive) {
      throw new Error(
        `Entity.add("${def.componentName}") called on a destroyed entity.`,
      );
    }
    const store = componentRegistry.ensure(this.world, def);
    if (bitecsHasComponent(this.world, this.eid, store)) {
      throw new Error(`Entity already has component "${def.componentName}".`);
    }
    bitecsAddComponent(this.world, this.eid, store);
    const defaults = def.createDefaults();
    setFields(store, this.eid, defaults);
    if (overrides !== undefined) {
      setFields(store, this.eid, overrides);
    }
    return this.get(def) as T;
  }

  /** `true` if this (living) entity carries the given component. */
  has<T extends SerializableRecord>(def: ComponentDef<T>): boolean {
    if (!this.isAlive) return false;
    const store = componentRegistry.ensure(this.world, def);
    return bitecsHasComponent(this.world, this.eid, store);
  }

  /**
   * Returns the cached proxy for this (entity, component) pair, or
   * `undefined` if the entity is stale/destroyed or never had the
   * component. Per ENGINE_DESIGN.md §21, the proxy is built once per pair
   * and reused for every subsequent call — never reallocated.
   */
  get<T extends SerializableRecord>(def: ComponentDef<T>): T | undefined {
    if (!this.isAlive) return undefined;
    const store = componentRegistry.ensure(this.world, def);
    if (!bitecsHasComponent(this.world, this.eid, store)) return undefined;

    let byComponent = this._proxyCache.get(this.eid);
    if (byComponent === undefined) {
      byComponent = new Map();
      this._proxyCache.set(this.eid, byComponent);
    }
    let proxy = byComponent.get(def.componentName);
    if (proxy === undefined) {
      proxy = createComponentProxy<T>(store, this.eid);
      byComponent.set(def.componentName, proxy);
    }
    return proxy as T;
  }

  /** Remove a component. No-op if the entity is stale or lacks it. */
  remove<T extends SerializableRecord>(def: ComponentDef<T>): void {
    if (!this.isAlive) return;
    const store = componentRegistry.ensure(this.world, def);
    if (!bitecsHasComponent(this.world, this.eid, store)) return;
    bitecsRemoveComponent(this.world, this.eid, store);
    this._proxyCache.get(this.eid)?.delete(def.componentName);
  }

  /**
   * Start a coroutine on this entity for work that spans multiple frames —
   * the required escape hatch for anything `onUpdate` can't do directly,
   * since `onUpdate` must not be `async` (CLAUDE.md's "onUpdate must not be
   * async"). The coroutine stops automatically the instant this entity is
   * no longer alive; see `ecs/Coroutines.ts` for the full cancellation
   * story (liveness check plus an opt-in `AbortSignal` for real async work).
   *
   * ```typescript
   * entity.startCoroutine(function* () {
   *   yield waitSeconds(1.0);
   *   doSomething();
   * });
   * ```
   */
  startCoroutine(factory: CoroutineFactory, id?: string): CoroutineHandle {
    return startCoroutine(this, factory, id);
  }

  /** Stop a coroutine by its id (the one returned from `startCoroutine`). */
  stopCoroutine(id: string): void {
    stopCoroutine(this, id);
  }
}

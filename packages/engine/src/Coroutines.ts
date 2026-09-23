import { entityExists, type World } from "bitecs";
import type { Entity } from "./Entity.js";
import { getOrCreate, getOrCreateMapEntry } from "./internal/scoped.js";
import {
  CoroutineSystem,
  type CoroutineGen,
} from "./systems/CoroutineSystem.js";

export type {
  CoroutineGen,
  CoroutineYield,
} from "./systems/CoroutineSystem.js";
export {
  waitFrames,
  waitSeconds,
  waitUntil,
} from "./systems/CoroutineSystem.js";

/**
 * A generator factory that also accepts an `AbortSignal`, so a coroutine
 * body that kicks off real async work (a `fetch`, a `postMessage`
 * round-trip) can pass the signal straight through and have it abort
 * automatically when the owning entity is destroyed — see the module doc
 * comment below for why this is a signal the coroutine body opts into,
 * not something the scheduler forces on every yield.
 */
export type CoroutineFactory =
  | CoroutineGen
  | (() => CoroutineGen)
  | ((signal: AbortSignal) => CoroutineGen);

/** A cancelable handle returned by `entity.startCoroutine()`. */
export interface CoroutineHandle {
  readonly id: string;
  cancel(): void;
}

/**
 * `startCoroutine()`/`stopCoroutine()` (CLAUDE.md's "`onUpdate` must not be
 * async" decision names `entity.startCoroutine()` as the escape hatch for
 * multi-frame work, and `Game.ts` throws a runtime error citing it by name
 * for async-`onUpdate` misuse — this file is what makes that method real on
 * `Entity`).
 *
 * Coroutines are scoped per-`World` (one per `Scene`, same as
 * `ComponentRegistry`/`PhysicsBody`'s side-tables — see CLAUDE.md's "Shared
 * internal helpers" entry) rather than per-entity, because the underlying
 * `systems/CoroutineSystem.ts` is already a flat `Map<id, CoroutineState>`
 * keyed by string id — reusing one `CoroutineSystem` instance per world and
 * namespacing each coroutine's id by its owning entity's raw id is simpler
 * than instantiating one `CoroutineSystem` per entity for what is usually
 * zero or one running coroutine per entity at a time.
 *
 * Cancellation is two-layered, per RELEASE_PASS.md's Track 0 decision:
 * 1. **Liveness check.** `updateCoroutines()` checks `entity.isAlive` before
 *    resuming each coroutine and stops it (without resuming) the moment the
 *    entity is dead — the same versioned-handle guarantee every other ECS
 *    API relies on, so a coroutine can never keep running against a
 *    destroyed (or, for a pooled entity, recycled) entity.
 * 2. **`AbortController`.** Each coroutine gets its own controller, aborted
 *    by `clearCoroutines()` (called from `Scene.destroy()`, mirroring
 *    `clearPhysicsBody`). A coroutine body that accepts the signal argument
 *    and threads it into its own async work (`fetch(url, { signal })`, a
 *    `postMessage` round-trip guarded by `signal.aborted`) gets structural
 *    cancellation of that nested work too, not just "stop resuming the
 *    generator" — matching Bevy's `Task<T>` cancel-on-drop shape. This is
 *    opt-in: a coroutine that never asked for the signal is unaffected
 *    either way, since the liveness check alone already stops it.
 */
interface CoroutineOwner {
  readonly system: CoroutineSystem;
  /** Which coroutine ids belong to which entity, for `clearCoroutines()`. */
  readonly idsByEntity: Map<number, Set<string>>;
  readonly controllers: Map<string, AbortController>;
  /** Entities with at least one live coroutine, checked once per `updateCoroutines()` call. */
  readonly liveEntities: Set<number>;
  nextId: number;
}

const ownerByWorld = new WeakMap<World, CoroutineOwner>();

function ensureOwner(world: World): CoroutineOwner {
  return getOrCreate(ownerByWorld, world, () => ({
    system: new CoroutineSystem(),
    idsByEntity: new Map(),
    controllers: new Map(),
    liveEntities: new Set(),
    nextId: 0,
  }));
}

/**
 * Start a coroutine on `entity`. The coroutine is stopped automatically the
 * instant the entity is no longer alive (checked every `updateCoroutines()`
 * call) — game code never has to manually stop a coroutine on entity
 * destroy.
 *
 * @example
 * ```typescript
 * entity.startCoroutine(function* () {
 *   yield waitSeconds(1.0);
 *   doSomething();
 * });
 *
 * // Opt into abort-on-destroy for real async work:
 * entity.startCoroutine(function* (signal) {
 *   const res = yield* awaitFetch(fetch("/api/loot", { signal }));
 *   doSomethingWith(res);
 * });
 * ```
 */
export function startCoroutine(
  entity: Entity,
  factory: CoroutineFactory,
  id?: string,
): CoroutineHandle {
  if (!entity.isAlive) {
    throw new Error("entity.startCoroutine() called on a destroyed entity.");
  }
  const owner = ensureOwner(entity.world);
  const resolvedId = id ?? `co_${entity.rawId}_${owner.nextId++}`;
  const controller = new AbortController();
  const gen =
    typeof factory === "function" ? factory(controller.signal) : factory;

  owner.controllers.set(resolvedId, controller);
  getOrCreateMapEntry(owner.idsByEntity, entity.eid, () => new Set()).add(
    resolvedId,
  );
  owner.liveEntities.add(entity.eid);
  owner.system.start(resolvedId, gen);

  return {
    id: resolvedId,
    cancel: () => stopCoroutine(entity, resolvedId),
  };
}

/** Stop a single coroutine by its id (the one returned from `startCoroutine`). */
export function stopCoroutine(entity: Entity, id: string): void {
  const owner = ownerByWorld.get(entity.world);
  if (owner === undefined) return;
  owner.system.stop(id);
  owner.controllers.get(id)?.abort();
  owner.controllers.delete(id);
  owner.idsByEntity.get(entity.eid)?.delete(id);
}

/**
 * Step every running coroutine in `world` by `dt`. Called once per frame
 * from `Game.update()`'s per-scene frame step, after physics and before
 * `onUpdate` — the same "engine-driven state settles before user code runs"
 * ordering `runFrame()` already uses for actors/physics.
 */
export function updateCoroutines(world: World, dt: number): void {
  const owner = ownerByWorld.get(world);
  if (owner === undefined || owner.liveEntities.size === 0) return;

  for (const eid of [...owner.liveEntities]) {
    if (entityExists(world, eid)) continue;
    // Entity died since the last update — stop every coroutine it owned
    // without resuming them again, and abort their controllers.
    const ids = owner.idsByEntity.get(eid);
    if (ids !== undefined) {
      for (const id of ids) {
        owner.system.stop(id);
        owner.controllers.get(id)?.abort();
        owner.controllers.delete(id);
      }
    }
    owner.idsByEntity.delete(eid);
    owner.liveEntities.delete(eid);
  }

  owner.system.update(dt);
}

/**
 * Clear every coroutine `eid` owns on `world`, aborting their controllers.
 * Called from `Scene.destroy()` for both the pooled-reset and real-destroy
 * paths, mirroring `clearPhysicsBody` — without this, a pooled entity's
 * bitECS id (deliberately never released back to bitECS's own recycling)
 * could inherit a coroutine still scheduled against the previous occupant.
 */
export function clearCoroutines(world: World, eid: number): void {
  const owner = ownerByWorld.get(world);
  if (owner === undefined) return;
  const ids = owner.idsByEntity.get(eid);
  if (ids !== undefined) {
    for (const id of ids) {
      owner.system.stop(id);
      owner.controllers.get(id)?.abort();
      owner.controllers.delete(id);
    }
  }
  owner.idsByEntity.delete(eid);
  owner.liveEntities.delete(eid);
}

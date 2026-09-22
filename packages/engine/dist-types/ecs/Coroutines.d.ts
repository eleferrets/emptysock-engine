import { type World } from "bitecs";
import type { Entity } from "./Entity.js";
import { type CoroutineGen } from "../systems/CoroutineSystem.js";
export type {
  CoroutineGen,
  CoroutineYield,
} from "../systems/CoroutineSystem.js";
export {
  waitFrames,
  waitSeconds,
  waitUntil,
} from "../systems/CoroutineSystem.js";
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
 * Start a coroutine on `entity`. The coroutine is stopped automatically the
 * instant the entity is no longer alive (checked every `updateCoroutines()`
 * call) — game code never has to manually stop a coroutine on entity
 * destroy the way the classic `Entity.startCoroutine()` didn't either.
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
export declare function startCoroutine(
  entity: Entity,
  factory: CoroutineFactory,
  id?: string,
): CoroutineHandle;
/** Stop a single coroutine by its id (the one returned from `startCoroutine`). */
export declare function stopCoroutine(entity: Entity, id: string): void;
/**
 * Step every running coroutine in `world` by `dt`. Called once per frame
 * from `Game.update()`'s per-scene frame step, after physics and before
 * `onUpdate` — the same "engine-driven state settles before user code runs"
 * ordering `runFrame()` already uses for actors/physics.
 */
export declare function updateCoroutines(world: World, dt: number): void;
/**
 * Clear every coroutine `eid` owns on `world`, aborting their controllers.
 * Called from `Scene.destroy()` for both the pooled-reset and real-destroy
 * paths, mirroring `clearPhysicsBody` — without this, a pooled entity's
 * bitECS id (deliberately never released back to bitECS's own recycling)
 * could inherit a coroutine still scheduled against the previous occupant.
 */
export declare function clearCoroutines(world: World, eid: number): void;

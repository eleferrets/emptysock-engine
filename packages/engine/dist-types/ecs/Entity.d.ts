import type { ComponentDef } from "./Component.js";
import { type CoroutineFactory, type CoroutineHandle } from "./Coroutines.js";
import type { SerializableRecord } from "./Serializable.js";
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
export declare class Entity {
  /** Raw numeric id, version bits stripped — mainly useful for logging. */
  get rawId(): number;
  /**
   * `false` once this entity (or the slot it used to occupy) has been
   * destroyed and, for a stale handle, recycled — bitECS's versioned ids
   * make this comparison exact rather than "probably still valid".
   */
  get isAlive(): boolean;
  /**
   * Add a component to this entity. Throws on a stale/destroyed handle
   * (mutating something that no longer exists is a bug, not a no-op) and
   * throws if the component is already present — same "one shot" semantics
   * the classic `addComponent` has.
   */
  add<T extends SerializableRecord>(
    def: ComponentDef<T>,
    overrides?: Partial<T>,
  ): T;
  /** `true` if this (living) entity carries the given component. */
  has<T extends SerializableRecord>(def: ComponentDef<T>): boolean;
  /**
   * Returns the cached proxy for this (entity, component) pair, or
   * `undefined` if the entity is stale/destroyed or never had the
   * component. Per ENGINE_DESIGN.md §21, the proxy is built once per pair
   * and reused for every subsequent call — never reallocated.
   */
  get<T extends SerializableRecord>(def: ComponentDef<T>): T | undefined;
  /** Remove a component. No-op if the entity is stale or lacks it. */
  remove<T extends SerializableRecord>(def: ComponentDef<T>): void;
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
  startCoroutine(factory: CoroutineFactory, id?: string): CoroutineHandle;
  /** Stop a coroutine by its id (the one returned from `startCoroutine`). */
  stopCoroutine(id: string): void;
}

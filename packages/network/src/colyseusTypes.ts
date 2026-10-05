/**
 * Structural (duck-typed) subset of the colyseus.js 0.16 client API this
 * package actually uses. Confirmed against colyseus.js's own docs
 * (`getStateCallbacks(room)` returning a `$(instance)` proxy with
 * `.listen(field, cb)`, and collections exposing `.onAdd`/`.onRemove` — see
 * https://docs.colyseus.io/state/callbacks and the 0.16 migration guide)
 * rather than assumed from memory, per the engine design notes own standard for
 * load-bearing external-library claims.
 *
 * Kept structural/minimal (not `import type { Room } from "colyseus.js"`
 * directly in the public bridge API) so tests can supply a lightweight fake
 * room/schema without spinning up a real Colyseus server — there is no
 * Colyseus testing-utilities package that fakes a client-side connection,
 * only server-side room test helpers, which don't cover what this package
 * needs to exercise (the *client's* schema-callback wiring).
 */

/** Anything colyseus.js's `room.send(type, payload)` can be called on. */
export interface RoomLike {
  readonly sessionId: string;
  readonly state: unknown;
  send(type: string, payload: unknown): void;
}

/** The `$(instance).listen(field, cb)` shape colyseus.js's schema-callbacks proxy exposes. */
export interface SchemaProxyLike<T> {
  listen<K extends keyof T & string>(
    field: K,
    callback: (value: T[K], previousValue: T[K]) => void,
  ): () => void;
}

/** The `$(collection).onAdd/.onRemove` shape colyseus.js exposes for a `MapSchema`/`ArraySchema` field. */
export interface SchemaCollectionLike<T> {
  onAdd(callback: (item: T, key: string) => void): () => void;
  onRemove(callback: (item: T, key: string) => void): () => void;
}

/**
 * What `getStateCallbacks(room)` returns: calling it on a `Schema` instance
 * gives you `SchemaProxyLike`; calling it on a `MapSchema`/`ArraySchema`
 * field gives you `SchemaCollectionLike`. colyseus.js's real proxy supports
 * both shapes on the same object (nested property access narrows which one
 * applies) — we model that here as an intersection plus index access for
 * "get the collection at this key".
 */
export type StateCallbacksProxy<T> = SchemaProxyLike<T> &
  SchemaCollectionLike<T> & {
    [key: string]: SchemaCollectionLike<unknown> & SchemaProxyLike<unknown>;
  };

/** What `$(instance)` (the value `getStateCallbacks(room)` returns) does when applied to a schema instance or collection. */
export type CallbackProxyFn = <T>(instance: T) => StateCallbacksProxy<T>;

/**
 * colyseus.js's real `getStateCallbacks(room)` — called once per room with
 * the `Room` itself, returning the `$` proxy function you then apply to
 * `room.state`, a nested `Schema` instance, or a `MapSchema`/`ArraySchema`
 * collection (`const $ = getStateCallbacks(room); $(room.state).players.onAdd(...)`).
 */
export type GetStateCallbacksFn = (room: RoomLike) => CallbackProxyFn;

/**
 * Typed accessor for "get the `SchemaCollectionLike` at this key of a
 * `StateCallbacksProxy`" — the one shape-cast every call site that binds a
 * room-state collection (e.g. `$(room.state).players`) needs. Centralising
 * it here means the `as unknown as {...}` double-cast for that shape is
 * written once, not re-derived ad hoc at each call site.
 */
export function getCollection<T>(
  proxy: StateCallbacksProxy<unknown>,
  key: string,
): SchemaCollectionLike<T> {
  return proxy[key] as unknown as SchemaCollectionLike<T>;
}

/**
 * Typed accessor for "get the `SchemaProxyLike` for this schema instance" —
 * the shape-cast every call site that does `$(schema).listen(...)` needs.
 */
export function getSchemaProxy<T>(
  proxy: CallbackProxyFn,
  schema: unknown,
): SchemaProxyLike<T> {
  return proxy(schema) as unknown as SchemaProxyLike<T>;
}

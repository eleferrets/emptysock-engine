/**
 * A `Game`-scoped store for arbitrarily-named, arbitrarily-typed values
 * reachable from anywhere gameplay code runs — the real target for
 * GameMaker's `global.x = expr` semantic (see `compat/gmlActions.ts`'s
 * `GmlActionContext` and `gms2-transpile.ts`'s `global.` rewrite pass).
 *
 * Deliberately not `VariableStore`: that class is a numbered,
 * integer-truncating, capped-at-1000, RPG-Maker-style variables/switches
 * store — a real, different feature this engine already ships, not a
 * general-purpose named-value bag. Forcing GML's `global.x` (arbitrary
 * names, arbitrary value types — numbers, strings, booleans, structs,
 * arrays) through that shape would either truncate float values to
 * integers or refuse to hold anything but a number/boolean at all. This
 * class is the real, correctly-shaped equivalent: a plain `Map<string,
 * unknown>`, no numeric-index indirection, no type coercion.
 *
 * Registered as a `Game` service the same way `PluginSystem`/
 * `VariableStore` are (see `Services.ts`'s own doc comment and `Game.ts`'s
 * constructor) — one instance per `Game`, alive for its whole lifetime,
 * handed to scene code via `SceneLifecycle.globals` for convenience.
 */
export interface GameGlobals {}
export declare class GlobalStore {
  private readonly _values;
  get<K extends keyof GameGlobals>(name: K): GameGlobals[K] | undefined;
  get<T = unknown>(name: string): T | undefined;
  set<K extends keyof GameGlobals>(name: K, value: GameGlobals[K]): void;
  set(name: string, value: unknown): void;
  has(name: string): boolean;
  delete(name: string): boolean;
  /** Every currently-set global name, for debugging/inspection tooling. */
  keys(): IterableIterator<string>;
  /** Clears every stored global — mainly for test isolation between `Game` instances. */
  clear(): void;
}

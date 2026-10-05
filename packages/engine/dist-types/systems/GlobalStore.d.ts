import type { Serializable } from "../Serializable.js";
/**
 * A `Game`-scoped store for arbitrarily-named, arbitrarily-typed values
 * reachable from anywhere gameplay code runs — the real target for
 * `global.x = expr` semantic (see the compat layer's action context).
 *
 * Deliberately not `VariableStore`: that class is a numbered,
 * integer-truncating, capped-at-1000, RPG-Maker-style variables/switches
 * store — a real, different feature this engine already ships, not a
 * general-purpose named-value bag. Forcing `global.x` (arbitrary
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
/**
 * Augmentable registry of known global names -> value types. Game code (or
 * the IDE's generated globals declaration file) extends it via declaration
 * merging so `ctx.globals.get("score")` is typed and autocompleted:
 *
 *     declare module "@emptysock/engine" { interface GameGlobals { score: number } }
 *
 * Names not declared here still work through the untyped string overloads.
 */
export interface GameGlobals {}
/** What `GlobalStore.declare` records for a name. */
export interface GlobalDeclaration {
  /** Value the name takes on declare (when unset) and after `reset()`. Must be JSON-clean. */
  readonly initial?: Serializable;
  /** Only `persist: true` names enter `snapshot()` (and so save files). Default `false`. */
  readonly persist?: boolean;
}
export declare class GlobalStore {
  private readonly _values;
  private readonly _decls;
  /**
   * Declare `name` with an optional initial value and persistence flag. If
   * the name has no value yet and an `initial` is given, it is set to a copy
   * of it. Re-declaring replaces the declaration and never overwrites an
   * existing value. Undeclared names keep working through `set`.
   */
  declare(name: string, decl?: GlobalDeclaration): void;
  /** Names passed to `declare`, in declaration order. */
  declared(): string[];
  /**
   * JSON-clean copy of every declared `persist: true` name that currently has
   * a value. A value that is not JSON-clean (function, entity, map...) is
   * dropped with a warning rather than failing the whole snapshot.
   */
  snapshot(): Record<string, Serializable>;
  /**
   * Apply a `snapshot()` result. Only declared `persist: true` names are
   * applied; anything else is ignored with a warning (a save from an older or
   * newer build must not inject arbitrary globals).
   */
  restore(data: Readonly<Record<string, unknown>>): void;
  /**
   * Drop every value (declared or not), then re-apply declared initials.
   * `game_restart` semantics: globals are whole-process state and a restart
   * forgets all of it. Declarations themselves are kept.
   */
  reset(): void;
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

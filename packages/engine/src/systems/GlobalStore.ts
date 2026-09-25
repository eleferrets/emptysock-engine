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
export class GlobalStore {
  private readonly _values = new Map<string, unknown>();

  get<T = unknown>(name: string): T | undefined {
    return this._values.get(name) as T | undefined;
  }

  set(name: string, value: unknown): void {
    this._values.set(name, value);
  }

  has(name: string): boolean {
    return this._values.has(name);
  }

  delete(name: string): boolean {
    return this._values.delete(name);
  }

  /** Every currently-set global name, for debugging/inspection tooling. */
  keys(): IterableIterator<string> {
    return this._values.keys();
  }

  /** Clears every stored global — mainly for test isolation between `Game` instances. */
  clear(): void {
    this._values.clear();
  }
}

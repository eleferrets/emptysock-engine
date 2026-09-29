import type { Serializable } from "../Serializable.js";

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

const MAX_SERIALIZE_DEPTH = 32;

/**
 * Deep copy of `v` if it is JSON-clean (null, boolean, finite number, string,
 * arrays and plain objects of those), else `undefined` in the result. Class
 * instances (entities, maps), functions and non-finite numbers are rejected.
 */
function cleanCopy(
  v: unknown,
  depth = 0,
): { readonly value: Serializable } | undefined {
  if (v === null || typeof v === "boolean" || typeof v === "string") {
    return { value: v };
  }
  if (typeof v === "number") {
    return Number.isFinite(v) ? { value: v } : undefined;
  }
  if (typeof v !== "object" || depth >= MAX_SERIALIZE_DEPTH) return undefined;
  if (Array.isArray(v)) {
    const out: Serializable[] = [];
    for (const item of v) {
      const c = cleanCopy(item, depth + 1);
      if (c === undefined) return undefined;
      out.push(c.value);
    }
    return { value: out };
  }
  const proto = Object.getPrototypeOf(v);
  if (proto !== Object.prototype && proto !== null) return undefined;
  const out: Record<string, Serializable> = {};
  for (const [k, item] of Object.entries(v)) {
    const c = cleanCopy(item, depth + 1);
    if (c === undefined) return undefined;
    out[k] = c.value;
  }
  return { value: out };
}

export class GlobalStore {
  private readonly _values = new Map<string, unknown>();
  private readonly _decls = new Map<string, GlobalDeclaration>();

  /**
   * Declare `name` with an optional initial value and persistence flag. If
   * the name has no value yet and an `initial` is given, it is set to a copy
   * of it. Re-declaring replaces the declaration and never overwrites an
   * existing value. Undeclared names keep working through `set`.
   */
  declare(name: string, decl: GlobalDeclaration = {}): void {
    let initial: Serializable | undefined;
    if (decl.initial !== undefined) {
      const c = cleanCopy(decl.initial);
      if (c === undefined) {
        console.warn(
          `[GlobalStore] declare("${name}"): initial value is not JSON-clean - ignored.`,
        );
      } else {
        initial = c.value;
      }
    }
    this._decls.set(name, {
      ...(initial !== undefined ? { initial } : {}),
      persist: decl.persist === true,
    });
    if (initial !== undefined && !this._values.has(name)) {
      this._values.set(name, cleanCopy(initial)?.value);
    }
  }

  /** Names passed to `declare`, in declaration order. */
  declared(): string[] {
    return [...this._decls.keys()];
  }

  /**
   * JSON-clean copy of every declared `persist: true` name that currently has
   * a value. A value that is not JSON-clean (function, entity, map...) is
   * dropped with a warning rather than failing the whole snapshot.
   */
  snapshot(): Record<string, Serializable> {
    const out: Record<string, Serializable> = {};
    for (const [name, decl] of this._decls) {
      if (decl.persist !== true || !this._values.has(name)) continue;
      const c = cleanCopy(this._values.get(name));
      if (c === undefined) {
        console.warn(
          `[GlobalStore] snapshot: value of "${name}" is not JSON-clean - not saved.`,
        );
        continue;
      }
      out[name] = c.value;
    }
    return out;
  }

  /**
   * Apply a `snapshot()` result. Only declared `persist: true` names are
   * applied; anything else is ignored with a warning (a save from an older or
   * newer build must not inject arbitrary globals).
   */
  restore(data: Readonly<Record<string, unknown>>): void {
    for (const [name, value] of Object.entries(data)) {
      const decl = this._decls.get(name);
      if (decl === undefined || decl.persist !== true) {
        console.warn(
          `[GlobalStore] restore: "${name}" is not a declared persistent global - ignored.`,
        );
        continue;
      }
      const c = cleanCopy(value);
      if (c === undefined) {
        console.warn(
          `[GlobalStore] restore: value of "${name}" is not JSON-clean - ignored.`,
        );
        continue;
      }
      this._values.set(name, c.value);
    }
  }

  /**
   * Drop every value (declared or not), then re-apply declared initials.
   * `game_restart` semantics: globals are whole-process state and a restart
   * forgets all of it. Declarations themselves are kept.
   */
  reset(): void {
    this._values.clear();
    for (const [name, decl] of this._decls) {
      if (decl.initial !== undefined) {
        this._values.set(name, cleanCopy(decl.initial)?.value);
      }
    }
  }

  get<K extends keyof GameGlobals>(name: K): GameGlobals[K] | undefined;
  get<T = unknown>(name: string): T | undefined;
  get(name: string): unknown {
    return this._values.get(name);
  }

  set<K extends keyof GameGlobals>(name: K, value: GameGlobals[K]): void;
  set(name: string, value: unknown): void;
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

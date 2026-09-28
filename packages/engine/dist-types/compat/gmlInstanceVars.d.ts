import type { World } from "bitecs";
import type { Entity } from "../Entity.js";
import type { GmlActionContext } from "./gmlActions.js";
export declare function getGmlVar(
  entity: Entity,
  _ctx: GmlActionContext,
  name: string,
): unknown;
export declare function setGmlVar(
  entity: Entity,
  _ctx: GmlActionContext,
  name: string,
  value: unknown,
): unknown;
export declare function hasGmlVar(
  entity: Entity,
  _ctx: GmlActionContext,
  name: string,
): boolean;
/**
 * GameMaker's other implicit-declaration shape: an undeclared name's *first*
 * assignment can be an indexed one (`endtext[0] = "...";`), which implicitly
 * creates a real, per-instance array the same way a bare `name = expr;`
 * implicitly creates a scalar field (see this module's own doc comment) —
 * confirmed against a real, full GameMaker project (Freedom Backup's
 * `obj_ending`/`obj_pause_menu`/`obj_menu` all build a dialogue/menu-option
 * list this way, with no `var`/array-literal declaration anywhere). This
 * getter is the array equivalent of `getGmlVar`: it returns the entity's
 * already-stored array for `name` if one exists, or creates, stores, and
 * returns a fresh empty one otherwise — always returning the *same*
 * reference each call, so `gms2-transpile.ts`'s indexed-assignment rewrite
 * (`GmlActions.getGmlArrayVar(_entity, _ctx, "name")[i] = value;`) mutates
 * the one real stored array in place rather than a disposable copy.
 */
export declare function getGmlArrayVar(
  entity: Entity,
  ctx: GmlActionContext,
  name: string,
): unknown[];
/** Clears every stored instance variable for this `(world, eid)` pair — called from `Scene.destroy()`. */
export declare function clearGmlInstanceVars(world: World, eid: number): void;
/**
 * Coerces a dynamically-typed GML value (an instance/cross-instance
 * variable's real `unknown` value, a legacy script `argumentN` value, …)
 * to a real `number` at runtime — a real, valid-JS alternative to a
 * TypeScript-only `as number` type assertion, used everywhere the
 * transpiler rewrites a bare read of one of these into an arithmetic
 * position (`gms2-transpile.ts`'s bare-read/cross-instance-read passes,
 * `gms2-codegen.ts`'s legacy `argument[N]`/`argumentN` rewrite).
 *
 * A GML instance variable read in expression position is overwhelmingly
 * numeric in real usage (gravity, speed, hp, counters — the same honest
 * assumption `gms2-transpile.ts`'s compound-assignment pass already made
 * with its own `as number | undefined ?? 0` cast). Unlike a bare type
 * assertion, this actually runs at runtime: `typeof value === "number"`
 * passes the real value straight through unchanged (the overwhelmingly
 * common case), and anything else is coerced via `Number(...)`, falling
 * back to `0` for a value `Number()` can't make sense of (`undefined`, a
 * non-numeric string, `NaN`) — matching GML's own loosely-typed runtime,
 * which performs the same implicit coercion in arithmetic position rather
 * than statically rejecting it. This keeps every generated `.behavior.ts`
 * module real, executable JavaScript once TypeScript's own type-only `as`
 * syntax is stripped at build time, *and* genuinely valid, runnable plain
 * JS even before that stripping happens — the same "real syntax-validity
 * proof via `new Function()`" guarantee this codebase's own transpiler
 * test suite already holds every other rewrite to.
 */
export declare function gmlNum(value: unknown): number;
/** `gmlNum`'s array/map siblings — see `gms2-transpile.ts`'s `ds_list_size`/`ds_list_clear`/`ds_map_size`/`ds_map_clear` rewrites. */
export declare function gmlArr(value: unknown): unknown[];
export declare function gmlMap(value: unknown): Map<unknown, unknown>;

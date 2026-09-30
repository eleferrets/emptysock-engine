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
/** Sets a variable-definition default only when nothing (a room instance's override) already set it. */
export declare function setGmlVarDefault(
  entity: Entity,
  ctx: GmlActionContext,
  name: string,
  value: unknown,
): void;
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
 * confirmed against a real, full GameMaker project (its
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
/** Shallow copy of every stored variable for `(world, eid)` — used by `GmsProjectRuntime`'s persistent-instance carry-over. */
export declare function exportGmlVars(
  world: World,
  eid: number,
): Map<string, unknown>;
/** Replaces `(world, eid)`'s stored variables with `vars` (a fresh copy is stored). */
export declare function importGmlVars(
  world: World,
  eid: number,
  vars: ReadonlyMap<string, unknown>,
): void;
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
 * common case); `undefined`/`null` become `0`, booleans `0`/`1` and numeric
 * strings their number. A non-numeric string or any object (ds_map, array,
 * struct, entity) is NOT a number and passes through unchanged rather than
 * being flattened to `0` — GML is dynamically typed, and a "numeric
 * position" rewrite must not destroy a text or a ds_map that merely got read
 * through the same helper. This keeps every generated `.behavior.ts`
 * module real, executable JavaScript once TypeScript's own type-only `as`
 * syntax is stripped at build time, *and* genuinely valid, runnable plain
 * JS even before that stripping happens — the same "real syntax-validity
 * proof via `new Function()`" guarantee this codebase's own transpiler
 * test suite already holds every other rewrite to.
 */
export declare function gmlNum(value: unknown): number;
/**
 * `gmlNum`'s exact sibling for `ds_list_size`/`ds_list_clear`'s real
 * `.length`/`.length = 0` rewrite: a bare GML `ds_list` variable
 * (`messages = ds_list_create();`, real, confirmed usage — a real project
 * Backup's own `oTextbox`) is a plain scalar instance variable as far as
 * `getGmlVar`/`setGmlVar`'s side-table is concerned (it holds a real JS
 * `Array`, `ds_list_create()`'s own real rewrite target, but nothing marks
 * it as "the array kind" the way `getGmlArrayVar`'s own *implicit-array*
 * shape does), so a bare read of it is `unknown` by the same "`getGmlVar`
 * bare reads are `unknown` by design" rule the `gmlNum` doc comment above
 * already establishes — `.length` on `unknown` does not typecheck. This
 * is the real runtime coercion `ds_list_size`/`_clear`'s rewritten output
 * wraps around a bare-read call site so it both typechecks and behaves
 * correctly: an already-real `Array` passes straight through unchanged
 * (the overwhelmingly common real case), anything else falls back to a
 * fresh empty array — the same "coerce, don't crash" shape `gmlNum` uses
 * for `0`, not a claim that a genuinely wrong-typed GML value silently
 * becomes a correct one.
 */
export declare function gmlArr(value: unknown): unknown[];
/** `gmlArr`'s exact `ds_map` sibling, backing `ds_map_size`/`_clear`'s real `.size`/`.clear()` rewrite the same way. */
export declare function gmlMap(value: unknown): Map<unknown, unknown>;

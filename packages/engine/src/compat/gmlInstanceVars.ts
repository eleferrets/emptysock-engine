import type { World } from "bitecs";
import type { Entity } from "../Entity.js";
import type { GmlActionContext } from "./gmlActions.js";
import { getOrCreate, getOrCreateMapEntry } from "../internal/scoped.js";

/**
 * Real per-GameMaker-instance variable storage — the missing piece behind a
 * severe, previously-undiscovered class of bug: a GML instance variable with
 * no declaring `var` (GameMaker's implicit "first bare assignment creates
 * this instance's own field" semantic — e.g. `cam = view_camera[0];` in an
 * object's Create event, read back by name in its Step event) used to get
 * rewritten by `gms2-transpile.ts`'s old "auto-declare on first bare
 * assignment" pass into a plain JS `var`, which is scoped to *that one
 * generated function* — since every GML event becomes its own JS function
 * (`gms2-codegen.ts`), the value was silently lost the instant the Create
 * event's function returned, and the Step event's read of the same name saw
 * a fresh, undeclared identifier instead of the value Create actually set.
 * Confirmed against a real, full GameMaker project (Freedom Backup's
 * `obj_camera`: `cam`/`follow`/`view_w_half`/`view_h_half`/`shake_remain`
 * are all set once in Create and read every frame in Step — the exact
 * "instance state that must survive across events" shape this was silently
 * breaking).
 *
 * This is the real fix: a side-table keyed by `(World, eid)`, the same
 * shape `PhysicsBody`'s callback side-table and `VisualScriptState`'s
 * per-entity evaluation scope already use for non-`Serializable` runtime
 * state that must persist for an entity's lifetime but has nowhere
 * `Serializable`-only component fields could hold it (a GML instance
 * variable is arbitrarily named and arbitrarily typed — a number, a string,
 * another instance reference — the same reason `GlobalStore` exists as a
 * plain `Map` rather than forcing GML globals through a fixed schema).
 * `Scene.destroy()` calls `clearGmlInstanceVars(world, eid)` alongside
 * `clearPhysicsBody`/`clearVisualScriptScope`/`clearCoroutines`, for the
 * same pooled-id-reuse reason every other per-`(World, eid)` side-table in
 * this codebase requires it.
 */
const sideTableByWorld = new WeakMap<
  World,
  Map<number, Map<string, unknown>>
>();

function ensureVars(world: World, eid: number): Map<string, unknown> {
  const byEntity = getOrCreate(sideTableByWorld, world, () => new Map());
  return getOrCreateMapEntry(byEntity, eid, () => new Map());
}

export function getGmlVar(
  entity: Entity,
  _ctx: GmlActionContext,
  name: string,
): unknown {
  return ensureVars(entity.world, entity.eid).get(name);
}

export function setGmlVar(
  entity: Entity,
  _ctx: GmlActionContext,
  name: string,
  value: unknown,
): unknown {
  ensureVars(entity.world, entity.eid).set(name, value);
  return value;
}

export function hasGmlVar(
  entity: Entity,
  _ctx: GmlActionContext,
  name: string,
): boolean {
  return ensureVars(entity.world, entity.eid).has(name);
}

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
export function getGmlArrayVar(
  entity: Entity,
  ctx: GmlActionContext,
  name: string,
): unknown[] {
  const existing = getGmlVar(entity, ctx, name);
  if (Array.isArray(existing)) return existing;
  const arr: unknown[] = [];
  setGmlVar(entity, ctx, name, arr);
  return arr;
}

/** Shallow copy of every stored variable for `(world, eid)` — used by `GmsProjectRuntime`'s persistent-instance carry-over. */
export function exportGmlVars(world: World, eid: number): Map<string, unknown> {
  return new Map(sideTableByWorld.get(world)?.get(eid) ?? []);
}

/** Replaces `(world, eid)`'s stored variables with `vars` (a fresh copy is stored). */
export function importGmlVars(
  world: World,
  eid: number,
  vars: ReadonlyMap<string, unknown>,
): void {
  const byEntity = getOrCreate(sideTableByWorld, world, () => new Map());
  byEntity.set(eid, new Map(vars));
}

/** Clears every stored instance variable for this `(world, eid)` pair — called from `Scene.destroy()`. */
export function clearGmlInstanceVars(world: World, eid: number): void {
  sideTableByWorld.get(world)?.delete(eid);
}

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
export function gmlNum(value: unknown): number {
  return typeof value === "number" ? value : Number(value) || 0;
}

/**
 * `gmlNum`'s exact sibling for `ds_list_size`/`ds_list_clear`'s real
 * `.length`/`.length = 0` rewrite: a bare GML `ds_list` variable
 * (`messages = ds_list_create();`, real, confirmed usage — Freedom
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
export function gmlArr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** `gmlArr`'s exact `ds_map` sibling, backing `ds_map_size`/`_clear`'s real `.size`/`.clear()` rewrite the same way. */
export function gmlMap(value: unknown): Map<unknown, unknown> {
  return value instanceof Map ? value : new Map();
}

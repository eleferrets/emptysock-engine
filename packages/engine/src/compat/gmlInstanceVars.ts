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

/** Clears every stored instance variable for this `(world, eid)` pair — called from `Scene.destroy()`. */
export function clearGmlInstanceVars(world: World, eid: number): void {
  sideTableByWorld.get(world)?.delete(eid);
}

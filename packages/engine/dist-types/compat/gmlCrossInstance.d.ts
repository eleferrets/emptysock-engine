import type { Entity } from "../Entity.js";
import { type GmlActionContext } from "./gmlActions.js";
/**
 * Real runtime resolution for a GML cross-instance dotted reference —
 * `obj_x.field` where `obj_x` is a real object-*type* name (not a local
 * variable holding a specific instance reference). See CLAUDE.md's "Cross-
 * file symbol table + real cross-instance/cross-object reference
 * resolution" section for the full design rationale and how
 * `gms2-transpile.ts` decides a given dotted reference is genuinely this
 * shape (via the project-wide symbol table in `gms2-symbols.ts`) rather
 * than a local variable or an unrelated dotted access.
 *
 * GameMaker's own real semantic for `obj_x.field` (confirmed against
 * GameMaker's manual's "Accessing variables in other instances" reference
 * page) is: "the value of `field` on the *first active instance* of object
 * type `obj_x`" — a genuine runtime lookup, re-resolved every time the
 * expression is evaluated, never a compile-time constant the way an enum
 * member is. This is exactly why it needs a real compat function rather
 * than a transpile-time constant substitution the way `TRANS_MODE.FADE`
 * gets (see `gms2-transpile.ts`'s enum pass) — which specific instance
 * `obj_x` resolves to can change from frame to frame as instances spawn
 * and are destroyed.
 *
 * Object-type resolution reuses `systems/GmlCollision.ts`'s
 * `resolveGmlObjectType` (`Meta.name`-keyed) so this can never disagree
 * with `onCollideWith<Type>` dispatch, `place_meeting`, or
 * `stepGmlCameraFollow`'s own object-type matching about what an
 * object-name argument resolves to — the same reuse rule those three
 * already establish for each other. The found instance's own field value
 * is read/written through `getGmlVar`/`setGmlVar` — the same per-`(World,
 * eid)` instance-variable side-table every other transpiled bare
 * identifier read/write in this codebase already goes through (see
 * `gmlInstanceVars.ts`'s own doc comment) — so a value written via
 * `obj_x.field = v;` from one instance and later read as a plain bare
 * `field` from inside `obj_x`'s own event code sees the same value,
 * exactly matching GameMaker's own single, unified instance-variable
 * namespace per instance.
 */
export declare function getGmlObjectVar(
  entity: Entity,
  ctx: GmlActionContext,
  objectName: string,
  field: string,
): unknown;
/**
 * A GameMaker built-in instance variable (position, image_*, motion) lives on
 * a component or in the motion side-table, not in the generic instance-variable
 * store, so a dotted read/write of it on another instance must route the same
 * way a same-instance bare `image_angle` does.
 */
export declare function readInstanceField(
  target: Entity,
  ctx: GmlActionContext,
  field: string,
): unknown;
/** See `readInstanceField`. */
export declare function writeInstanceField(
  target: Entity,
  ctx: GmlActionContext,
  field: string,
  value: unknown,
): void;
export declare function setGmlObjectVar(
  entity: Entity,
  ctx: GmlActionContext,
  objectName: string,
  field: string,
  value: unknown,
): unknown;
/**
 * Offset added to the scene's `EntityId` to form a numeric GML instance id.
 * The GameMaker manual (`id` instance variable page, `instance_find` page)
 * only says an id is a unique handle, and gives no numeric floor: the value
 * 100000 is this engine's own convention, chosen so instance ids never
 * collide with small asset/object indices in the same numeric space. It is
 * not a GameMaker guarantee, and GML must not depend on the number itself.
 */
export declare const GML_INSTANCE_ID_BASE = 100000;
/** Numeric GML instance id for `entity`: `GML_INSTANCE_ID_BASE + scene id`, stable for the entity's life, never reused in its scene. */
export declare function gmlInstanceId(entity: Entity): number;
/** Live instance for a numeric id from `gmlInstanceId`, else `undefined` (unknown, destroyed, or below the base, i.e. an object index). */
export declare function gmlInstanceFromId(
  ctx: GmlActionContext,
  id: number,
): Entity | undefined;
/**
 * Real runtime resolution for GML's *other* dotted-reference shape: a
 * local instance variable that holds a specific `Entity` reference (e.g.
 * `my_gun = instance_create_layer(...)`, then later `my_gun.x`), as
 * opposed to `getGmlObjectVar` above's object-*type*-name shape
 * (`obj_player.x`). See `gms2-transpile.ts`'s narrow, same-function
 * pre-scan (the "GML local-variable-held instance references" section)
 * for exactly which assignments this covers and — just as importantly —
 * which real, confirmed occurrence in a real project it deliberately does
 * *not* cover.
 *
 * `varName`'s own current value is read through the *same* `getGmlVar`
 * per-`(World, eid)` side-table every other bare instance-variable read
 * already uses — a local variable that holds an instance reference is
 * still, mechanically, just an ordinary GML instance variable whose value
 * happens to be an `Entity` rather than a number/string, so there is no
 * second storage mechanism to invent here. Once resolved, the dotted
 * field itself routes through the exact same `x`/`y`-special-cased-else-
 * generic-side-table logic `getGmlObjectVar`/`setGmlObjectVar` above
 * already establish, reused via `readField`/`writeField` rather than
 * duplicated a second time.
 *
 * A `varName` whose stored value is not a real, live `Entity` (never
 * assigned, assigned something else, or the instance it pointed to was
 * since destroyed) is a real, honest no-op — `undefined` on read, a
 * console warning on write — the same "no live instance to even ask"
 * convention `getGmlObjectVar`/`setGmlObjectVar` already follow for their
 * own "object type has no live instance" case, not a crash.
 */
export declare function getGmlRefVar(
  entity: Entity,
  ctx: GmlActionContext,
  varName: string,
  field: string,
): unknown;
/** See `getGmlRefVar`'s own doc comment. */
export declare function setGmlRefVar(
  entity: Entity,
  ctx: GmlActionContext,
  varName: string,
  field: string,
  value: unknown,
): unknown;
/**
 * Reads `field` through any GML value: `other`, a variable holding an
 * instance or an object name, a struct. `undefined` when the value
 * addresses nothing (a destroyed instance, `noone`, a number).
 */
export declare function getGmlEntityField(
  ctx: GmlActionContext,
  target: unknown,
  field: string,
): unknown;
/** Writes `field` through any GML value; see `getGmlEntityField`. */
export declare function setGmlEntityField(
  ctx: GmlActionContext,
  target: unknown,
  field: string,
  value: unknown,
): unknown;
/**
 * `target.alarm[index]`: the alarm of another instance (`other`, a variable
 * holding an instance) or of the first live instance of a named object.
 * `-1` (GameMaker's "not set") when the target addresses no instance.
 */
export declare function get_gml_instance_alarm(
  ctx: GmlActionContext,
  target: unknown,
  index: number,
): number;
/** `target.alarm[index] = steps`; see `get_gml_instance_alarm`. A target that is no instance is a no-op. */
export declare function set_gml_instance_alarm(
  ctx: GmlActionContext,
  target: unknown,
  index: number,
  steps: number,
): void;

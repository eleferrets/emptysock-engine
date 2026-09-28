import type { Entity } from "../Entity.js";
import type { GmlActionContext } from "./gmlActions.js";
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
export declare function setGmlObjectVar(
  entity: Entity,
  ctx: GmlActionContext,
  objectName: string,
  field: string,
  value: unknown,
): unknown;
/**
 * Real runtime resolution for GML's *other* dotted-reference shape: a
 * local instance variable that holds a specific `Entity` reference (e.g.
 * `my_gun = instance_create_layer(...)`, then later `my_gun.x`), as
 * opposed to `getGmlObjectVar` above's object-*type*-name shape
 * (`obj_player.x`). See `gms2-transpile.ts`'s narrow, same-function
 * pre-scan (the "GML local-variable-held instance references" section)
 * for exactly which assignments this covers and — just as importantly —
 * which real, confirmed Freedom Backup occurrence it deliberately does
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

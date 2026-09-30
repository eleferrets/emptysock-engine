import type { Entity } from "../Entity.js";
import { isEntityRef } from "../EntityRef.js";
import { Meta } from "../components/Meta.js";
import { Transform } from "../components/Transform.js";
import { Sprite } from "../components/Sprite.js";
import {
  getGmlDirection,
  setGmlDirection,
  getGmlSpeed,
  setGmlSpeed,
  getGmlHspeed,
  setGmlHspeed,
  getGmlVspeed,
  setGmlVspeed,
  get_gml_alarm,
  action_set_alarm,
  type GmlActionContext,
} from "./gmlActions.js";
import { getGmlVar, setGmlVar } from "./gmlInstanceVars.js";

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
export function getGmlObjectVar(
  entity: Entity,
  ctx: GmlActionContext,
  objectName: string,
  field: string,
): unknown {
  const target = findFirstInstanceOfType(ctx, objectName);
  if (target === undefined) return undefined;
  // `x`/`y` are GameMaker's own real built-in position variables, not an
  // ordinary implicit instance variable — see CLAUDE.md's "x/y built-in
  // position variables" section for why a same-instance bare `x`/`y`
  // already routes to `Transform.x`/`.y` rather than the generic
  // `getGmlVar`/`setGmlVar` side-table. A cross-instance `obj_x.x`/`.y`
  // reference (real, confirmed usage — a real project's own
  // `obj_player.x`/`obj_player.y`, 11+12 occurrences) must resolve
  // consistently with that, not silently read `undefined` from a
  // side-table `x`/`y` never actually populates.
  return readInstanceField(target, ctx, field);
}

/**
 * A GameMaker built-in instance variable (position, image_*, motion) lives on
 * a component or in the motion side-table, not in the generic instance-variable
 * store, so a dotted read/write of it on another instance must route the same
 * way a same-instance bare `image_angle` does.
 */
export function readInstanceField(
  target: Entity,
  ctx: GmlActionContext,
  field: string,
): unknown {
  const t = target.get(Transform);
  const sp = target.get(Sprite);
  switch (field) {
    case "x":
    case "y":
      return t?.[field] ?? 0;
    case "image_angle":
      return t === undefined ? 0 : (-t.rotation * 180) / Math.PI;
    case "image_xscale":
      return t?.scaleX ?? 1;
    case "image_yscale":
      return t?.scaleY ?? 1;
    case "image_alpha":
      return sp?.alpha ?? 1;
    case "image_index":
      return sp?.currentFrame ?? 0;
    case "image_speed":
      return sp?.frameSpeed ?? 1;
    case "depth":
      return sp === undefined ? 0 : -sp.depth;
    case "direction":
      return getGmlDirection(target, ctx);
    case "speed":
      return getGmlSpeed(target, ctx);
    case "hspeed":
      return getGmlHspeed(target, ctx);
    case "vspeed":
      return getGmlVspeed(target, ctx);
    default:
      return getGmlVar(target, ctx, field);
  }
}

/** See `readInstanceField`. */
export function writeInstanceField(
  target: Entity,
  ctx: GmlActionContext,
  field: string,
  value: unknown,
): void {
  const t = target.get(Transform);
  const sp = target.get(Sprite);
  const n = Number(value) || 0;
  switch (field) {
    case "x":
    case "y":
      if (t !== undefined) t[field] = n;
      return;
    case "image_angle":
      if (t !== undefined) t.rotation = (-n * Math.PI) / 180;
      return;
    case "image_xscale":
      if (t !== undefined) t.scaleX = n;
      return;
    case "image_yscale":
      if (t !== undefined) t.scaleY = n;
      return;
    case "image_alpha":
      if (sp !== undefined) sp.alpha = n;
      return;
    case "image_index":
      if (sp !== undefined) sp.currentFrame = n;
      return;
    case "image_speed":
      if (sp !== undefined) sp.frameSpeed = n;
      return;
    case "depth":
      if (sp !== undefined) sp.depth = -n;
      return;
    case "direction":
      setGmlDirection(target, ctx, n);
      return;
    case "speed":
      setGmlSpeed(target, ctx, n);
      return;
    case "hspeed":
      setGmlHspeed(target, ctx, n);
      return;
    case "vspeed":
      setGmlVspeed(target, ctx, n);
      return;
    default:
      setGmlVar(target, ctx, field, value);
  }
}

export function setGmlObjectVar(
  entity: Entity,
  ctx: GmlActionContext,
  objectName: string,
  field: string,
  value: unknown,
): unknown {
  const target = findFirstInstanceOfType(ctx, objectName);
  if (target === undefined) {
    console.warn(
      `[GmlCrossInstance] setGmlObjectVar: no live instance of object type "${objectName}" found — write to "${field}" dropped (GameMaker's own real behaviour for a nonexistent instance target throws; this compat layer instead honestly no-ops, matching this codebase's "no live instance to even ask" convention rather than crashing).`,
    );
    return value;
  }
  writeInstanceField(target, ctx, field, value);
  return value;
}

function findFirstInstanceOfType(
  ctx: GmlActionContext,
  objectName: string,
): Entity | undefined {
  let found: Entity | undefined;
  ctx.scene.each(Meta, (meta, e) => {
    if (found !== undefined) return;
    if (meta.name === objectName) found = e;
  });
  return found;
}

/**
 * Offset added to the scene's `EntityId` to form a numeric GML instance id.
 * The GameMaker manual (`id` instance variable page, `instance_find` page)
 * only says an id is a unique handle, and gives no numeric floor: the value
 * 100000 is this engine's own convention, chosen so instance ids never
 * collide with small asset/object indices in the same numeric space. It is
 * not a GameMaker guarantee, and GML must not depend on the number itself.
 */
export const GML_INSTANCE_ID_BASE = 100000;

/** Numeric GML instance id for `entity`: `GML_INSTANCE_ID_BASE + scene id`, stable for the entity's life, never reused in its scene. */
export function gmlInstanceId(entity: Entity): number {
  return GML_INSTANCE_ID_BASE + entity.ref().$ref;
}

/** Live instance for a numeric id from `gmlInstanceId`, else `undefined` (unknown, destroyed, or below the base, i.e. an object index). */
export function gmlInstanceFromId(
  ctx: GmlActionContext,
  id: number,
): Entity | undefined {
  if (!Number.isInteger(id) || id <= GML_INSTANCE_ID_BASE) return undefined;
  return ctx.scene.resolve({ $ref: id - GML_INSTANCE_ID_BASE });
}

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
export function getGmlRefVar(
  entity: Entity,
  ctx: GmlActionContext,
  varName: string,
  field: string,
): unknown {
  // A variable holding an object *index* (`follow = obj_player;`) refers to
  // the first live instance of that object, as in GameMaker; one holding a
  // struct reads the struct's field.
  return getGmlEntityField(ctx, getGmlVar(entity, ctx, varName), field);
}

/** See `getGmlRefVar`'s own doc comment. */
export function setGmlRefVar(
  entity: Entity,
  ctx: GmlActionContext,
  varName: string,
  field: string,
  value: unknown,
): unknown {
  const ref = getGmlVar(entity, ctx, varName);
  if (fieldOwner(ctx, ref).kind === "none") {
    console.warn(
      `[GmlCrossInstance] setGmlRefVar: variable "${varName}" holds neither a live instance nor a struct — write to "${field}" dropped.`,
    );
    return value;
  }
  return setGmlEntityField(ctx, ref, field, value);
}

/**
 * Duck-types `value` as a real, live `Entity` — `Entity` itself is a
 * concrete class (not a structural interface) with no runtime tag this
 * file can `instanceof`-check without importing the class value (only its
 * type is imported here, per this module's existing `import type { Entity
 * }`), so this checks for `Entity`'s own real, public shape (`.get`/
 * `.isAlive`) instead — the same "duck-type the public API surface"
 * approach `NetworkEntityMap`'s own `entity.rawId` reliance already takes
 * elsewhere in this codebase for a similar reason.
 */
function asLiveEntity(
  value: unknown,
  ctx?: GmlActionContext,
): Entity | undefined {
  // Numeric instance id (`gmlInstanceId`) or `EntityRef`: resolved through
  // the scene's id table, so a destroyed or pooled-away instance is dead.
  if (ctx !== undefined) {
    if (typeof value === "number") return gmlInstanceFromId(ctx, value);
    if (isEntityRef(value)) return ctx.scene.resolve(value);
  }
  if (
    typeof value !== "object" ||
    value === null ||
    typeof (value as { get?: unknown }).get !== "function" ||
    typeof (value as { isAlive?: unknown }).isAlive !== "boolean"
  ) {
    return undefined;
  }
  const candidate = value as Entity;
  return candidate.isAlive ? candidate : undefined;
}

/**
 * What a dynamically typed GML value addresses when a field is read or
 * written through it: a live instance (an `Entity`, instance id or
 * `EntityRef`), the first live instance of an object named by a string
 * (`follow = obj_player; follow.x`), or a struct.
 */
type FieldOwner =
  | { kind: "instance"; entity: Entity }
  | { kind: "struct"; struct: Record<string, unknown> }
  | { kind: "none" };

function fieldOwner(ctx: GmlActionContext, target: unknown): FieldOwner {
  const e =
    typeof target === "string"
      ? findFirstInstanceOfType(ctx, target)
      : asLiveEntity(target, ctx);
  if (e !== undefined) return { kind: "instance", entity: e };
  if (
    typeof target === "object" &&
    target !== null &&
    !Array.isArray(target) &&
    !(target instanceof Map) &&
    typeof (target as { get?: unknown }).get !== "function"
  )
    return { kind: "struct", struct: target as Record<string, unknown> };
  return { kind: "none" };
}

/**
 * Reads `field` through any GML value: `other`, a variable holding an
 * instance or an object name, a struct. `undefined` when the value
 * addresses nothing (a destroyed instance, `noone`, a number).
 */
export function getGmlEntityField(
  ctx: GmlActionContext,
  target: unknown,
  field: string,
): unknown {
  const o = fieldOwner(ctx, target);
  if (o.kind === "instance") return readInstanceField(o.entity, ctx, field);
  if (o.kind === "struct") return o.struct[field];
  return undefined;
}

/** Writes `field` through any GML value; see `getGmlEntityField`. */
export function setGmlEntityField(
  ctx: GmlActionContext,
  target: unknown,
  field: string,
  value: unknown,
): unknown {
  const o = fieldOwner(ctx, target);
  if (o.kind === "instance") writeInstanceField(o.entity, ctx, field, value);
  else if (o.kind === "struct") o.struct[field] = value;
  return value;
}

/**
 * `target.alarm[index]`: the alarm of another instance (`other`, a variable
 * holding an instance) or of the first live instance of a named object.
 * `-1` (GameMaker's "not set") when the target addresses no instance.
 */
export function get_gml_instance_alarm(
  ctx: GmlActionContext,
  target: unknown,
  index: number,
): number {
  const o = fieldOwner(ctx, target);
  return o.kind === "instance" ? get_gml_alarm(o.entity, ctx, index) : -1;
}

/** `target.alarm[index] = steps`; see `get_gml_instance_alarm`. A target that is no instance is a no-op. */
export function set_gml_instance_alarm(
  ctx: GmlActionContext,
  target: unknown,
  index: number,
  steps: number,
): void {
  const o = fieldOwner(ctx, target);
  if (o.kind === "instance") action_set_alarm(o.entity, ctx, index, steps);
}

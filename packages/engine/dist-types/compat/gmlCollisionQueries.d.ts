import type { Entity } from "../Entity.js";
import { type GmlActionContext } from "./gmlActions.js";
/**
 * A GameMaker object-reference argument as it arrives from transpiled GML: a
 * resolvable object-type name (matched against `resolveGmlObjectType`), or
 * one of GameMaker's two special constants. `all` matches every instance in
 * the scene; `noone` matches nothing — GameMaker also uses `noone` as the
 * *return* value meaning "nothing found" for `instance_place`/
 * `instance_position`/`collision_*`, which this file represents as
 * `undefined` (the closest real value a `Entity | undefined` return type has
 * — see each function's own doc comment).
 */
export type GmlObjectRef = string;
/** GML `instance_exists(obj)` — real, honest scene-wide existence check. `all` always returns `true` if the scene has at least one `Transform`-bearing entity; `noone` always returns `false`. */
export declare function instance_exists(
  entity: Entity,
  ctx: GmlActionContext,
  obj: GmlObjectRef,
): boolean;
/** GML `instance_number(obj)` — real, honest scene-wide count of instances matching `obj`. */
export declare function instance_number(
  entity: Entity,
  ctx: GmlActionContext,
  obj: GmlObjectRef,
): number;
/** GML `instance_find(obj, n)` - the n-th instance of `obj` (or `all`), or `"noone"`. Order is arbitrary but stable while the set is unchanged. */
export declare function instance_find(
  _entity: Entity,
  ctx: GmlActionContext,
  obj: GmlObjectRef,
  n: number,
): Entity | "noone";
/** GML `instance_nearest(x, y, obj)` by origin distance; ties go to the lowest entity id. */
export declare function instance_nearest(
  _entity: Entity,
  ctx: GmlActionContext,
  x: number,
  y: number,
  obj: GmlObjectRef,
): Entity | "noone";
/** GML `instance_furthest(x, y, obj)` by origin distance. */
export declare function instance_furthest(
  _entity: Entity,
  ctx: GmlActionContext,
  x: number,
  y: number,
  obj: GmlObjectRef,
): Entity | "noone";
/**
 * GameMaker's `place_meeting(x, y, obj)` — true if `entity`'s own collision
 * mask, hypothetically positioned at `(x, y)`, would overlap any instance of
 * `obj`. Does not move `entity` — `entity`'s real `Transform` is never
 * written, only read for its sprite-derived half-extents.
 */
export declare function place_meeting(
  entity: Entity,
  ctx: GmlActionContext,
  x: number,
  y: number,
  obj: GmlObjectRef,
): boolean;
/**
 * GameMaker's `place_free(x, y)` — true if `entity`'s mask, hypothetically
 * positioned at `(x, y)`, overlaps no `solid`-flagged instance (GameMaker's
 * real "Solid" object flag — see `Meta.solid`). Unlike `place_meeting`, this
 * checks against every solid instance in the scene, not one named object
 * type.
 */
export declare function place_free(
  entity: Entity,
  ctx: GmlActionContext,
  x: number,
  y: number,
): boolean;
/**
 * GameMaker's `place_snapped(hsnap, vsnap)` — true if `entity`'s *current*
 * position is already grid-aligned. Pure math against the live `Transform`,
 * no scene query and no hypothetical position involved (GameMaker's real
 * signature has no `x`/`y` — it always checks the instance's own current
 * position).
 */
export declare function place_snapped(
  entity: Entity,
  _ctx: GmlActionContext,
  hsnap: number,
  vsnap: number,
): boolean;
/**
 * GameMaker's `position_meeting(x, y, obj)` — true if the single *point*
 * `(x, y)` (not `entity`'s whole mask) is inside an instance of `obj`. The
 * real point-vs-mask distinction from `place_meeting`'s whole-mask check:
 * `entity`'s own extents never factor in here at all.
 */
export declare function position_meeting(
  entity: Entity,
  ctx: GmlActionContext,
  x: number,
  y: number,
  obj: GmlObjectRef,
): boolean;
/** GameMaker's `position_free(x, y)` — true if the point `(x, y)` has no `solid`-flagged instance under it. */
export declare function position_free(
  entity: Entity,
  ctx: GmlActionContext,
  x: number,
  y: number,
): boolean;
/**
 * GameMaker's `instance_place(x, y, obj)` — like `place_meeting` but returns
 * the actual first colliding instance (GameMaker's own `noone` on no match,
 * represented here as `undefined`), in scene-iteration order.
 */
export declare function instance_place(
  entity: Entity,
  ctx: GmlActionContext,
  x: number,
  y: number,
  obj: GmlObjectRef,
): Entity | undefined;
/** GameMaker's `instance_position(x, y, obj)` — like `position_meeting` but returns the actual instance at that point, or `undefined` (`noone`). */
export declare function instance_position(
  entity: Entity,
  ctx: GmlActionContext,
  x: number,
  y: number,
  obj: GmlObjectRef,
): Entity | undefined;
/** GameMaker's `collision_rectangle(x1, y1, x2, y2, obj, prec, notme)` — first instance of `obj` overlapping the given rectangle, or `undefined` (`noone`). `prec` is accepted for signature fidelity but always falls back to bbox checking. */
export declare function collision_rectangle(
  entity: Entity,
  ctx: GmlActionContext,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  obj: GmlObjectRef,
  _prec?: boolean,
  notme?: boolean,
): Entity | undefined;
/** GameMaker's `collision_circle(x, y, radius, obj, prec, notme)` — first instance of `obj` overlapping the given circle, or `undefined` (`noone`). */
export declare function collision_circle(
  entity: Entity,
  ctx: GmlActionContext,
  x: number,
  y: number,
  radius: number,
  obj: GmlObjectRef,
  _prec?: boolean,
  notme?: boolean,
): Entity | undefined;
/** GameMaker's `collision_line(x1, y1, x2, y2, obj, prec, notme)` — first instance of `obj` whose mask the given line segment crosses, or `undefined` (`noone`). */
export declare function collision_line(
  entity: Entity,
  ctx: GmlActionContext,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  obj: GmlObjectRef,
  _prec?: boolean,
  notme?: boolean,
): Entity | undefined;
/** GameMaker's `collision_point(x, y, obj, prec, notme)` — first instance of `obj` whose mask contains the given point, or `undefined` (`noone`). */
export declare function collision_point(
  entity: Entity,
  ctx: GmlActionContext,
  x: number,
  y: number,
  obj: GmlObjectRef,
  _prec?: boolean,
  notme?: boolean,
): Entity | undefined;

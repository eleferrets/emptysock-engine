// gmlCollisionQueries.ts — GameMaker's classic "would I overlap X if I were
// at (x, y)?" query family (`place_meeting`, `place_free`, `position_meeting`,
// `instance_place`, `collision_rectangle`, ...). This is THE mechanism a huge
// fraction of real GameMaker platformers/top-down games use for solid-wall
// collision: check a hypothetical position before actually moving there, and
// back off if it would overlap something solid. None of these move the
// calling instance — they only ever read `Transform`, never write it (the
// one narrow exception, `place_snapped`, reads the entity's *current*
// position and does pure math, no scene query at all).
//
// Sibling to `gmlActions.ts`, not an extension of it: every function here is
// still entity-affecting in the sense that the *calling instance's own mask*
// matters (`place_meeting`'s hypothetical position is checked using the
// caller's own sprite extents), so the signature is the same
// `(entity, ctx, ...gmlArgs)` shape `gmlActions.ts` established — but this
// file is a pure-query family (nothing here mutates state), a different
// shape from DnD's imperative actions, which is why it's a separate file
// rather than grown into either `gmlActions.ts` or `systems/GmlCollision.ts`
// (that file is event-*dispatch* focused — resolving and calling an
// `onCollideWith<Type>` handler once an overlap is already known — not a
// query API a transpiled GML expression can call inline).
//
// Object-type resolution reuses `systems/GmlCollision.ts`'s
// `resolveGmlObjectType` (keyed off `Meta.name`, the same identity concept
// `onCollideWith<Type>` dispatch already uses) so this file and that one can
// never disagree about what "obj_wall" resolves to. `all`/`noone` are
// GameMaker's own special object-reference constants: `all` matches every
// instance, `noone` matches nothing. A real object name that never got a
// resolvable `Meta.name` (for instance, an entity nothing ever stamped)
// simply never matches — the same "no resolvable type = never a match"
// behaviour `resolveGmlObjectType`'s own doc comment already documents for
// `onCollideWith<Type>` dispatch.
//
// Precision: this engine has no per-pixel collision mask data anywhere (only
// AABB, via `spriteHalfExtents`'s existing fixed-16px fallback) — every
// function here honestly treats GameMaker's `prec` (precise-checking)
// argument as a no-op, always falling back to bbox checking, consistent with
// `action_if_collision`'s existing precedent (see CLAUDE.md).
//
// `solid`: GameMaker objects carry a real "Solid" checkbox on the object
// resource (`.yy`'s `solid` field), independent of whether the object also
// has a `PhysicsBody`. `place_free`/`position_free` need real per-instance
// data to check against, so `Meta` (already the one "editor/tooling-visible
// per-instance identity" component `onCollideWith<Type>` dispatch reads)
// gained a `solid: boolean` field — see `components/Meta.ts` and
// `gms2-codegen.ts`'s `buildObjectPrefabJSON`, which now reads the object's
// real `.yy` `solid` field and emits a `Meta` component override when it's
// `true`. An entity with no `Meta` (or `Meta.solid: false`, the default) is
// simply not solid — the common case for a purely decorative/code-spawned
// entity.

import type { Entity } from "../Entity.js";
import { Transform } from "../components/Transform.js";
import { Meta } from "../components/Meta.js";
import { resolveGmlObjectType } from "../systems/GmlCollision.js";
import { spriteHalfExtents, type GmlActionContext } from "./gmlActions.js";

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

function objectRefMatches(other: Entity, obj: GmlObjectRef): boolean {
  if (obj === "noone") return false;
  if (obj === "all") return true;
  return resolveGmlObjectType(other) === obj;
}

function isSolid(entity: Entity): boolean {
  return entity.get(Meta)?.solid === true;
}

function aabbOverlap(
  ax: number,
  ay: number,
  aHalfW: number,
  aHalfH: number,
  bx: number,
  by: number,
  bHalfW: number,
  bHalfH: number,
): boolean {
  return (
    Math.abs(ax - bx) < aHalfW + bHalfW && Math.abs(ay - by) < aHalfH + bHalfH
  );
}

function pointInAabb(
  px: number,
  py: number,
  bx: number,
  by: number,
  bHalfW: number,
  bHalfH: number,
): boolean {
  return Math.abs(px - bx) <= bHalfW && Math.abs(py - by) <= bHalfH;
}

function rectOverlapsAabb(
  rx1: number,
  ry1: number,
  rx2: number,
  ry2: number,
  bx: number,
  by: number,
  bHalfW: number,
  bHalfH: number,
): boolean {
  const ox1 = bx - bHalfW;
  const ox2 = bx + bHalfW;
  const oy1 = by - bHalfH;
  const oy2 = by + bHalfH;
  return rx1 <= ox2 && rx2 >= ox1 && ry1 <= oy2 && ry2 >= oy1;
}

function circleOverlapsAabb(
  cx: number,
  cy: number,
  radius: number,
  bx: number,
  by: number,
  bHalfW: number,
  bHalfH: number,
): boolean {
  const closestX = Math.max(bx - bHalfW, Math.min(cx, bx + bHalfW));
  const closestY = Math.max(by - bHalfH, Math.min(cy, by + bHalfH));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy <= radius * radius;
}

/** Segment-vs-AABB test (Liang-Barsky clipping against the box's slab range on each axis). */
function segmentOverlapsAabb(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  bx: number,
  by: number,
  bHalfW: number,
  bHalfH: number,
): boolean {
  const minX = bx - bHalfW;
  const maxX = bx + bHalfW;
  const minY = by - bHalfH;
  const maxY = by + bHalfH;
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tMin = 0;
  let tMax = 1;
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > tMax) return false;
      if (r > tMin) tMin = r;
    } else {
      if (r < tMin) return false;
      if (r < tMax) tMax = r;
    }
    return true;
  };
  if (!clip(-dx, x1 - minX)) return false;
  if (!clip(dx, maxX - x1)) return false;
  if (!clip(-dy, y1 - minY)) return false;
  if (!clip(dy, maxY - y1)) return false;
  return tMin <= tMax;
}

/**
 * Walks every `Transform`-bearing entity in `ctx.scene` matching `obj`
 * (`resolveGmlObjectType`, `all`, or `noone`), always excluding `exclude`
 * itself (GameMaker's `place_meeting`/`position_meeting` family never
 * matches the calling instance against itself). `visit` returning nothing
 * continues; the caller is responsible for its own early-exit bookkeeping —
 * `Scene.each` has no early-break, the same shape `action_if_empty` already
 * works around.
 */
function eachOtherMatching(
  ctx: GmlActionContext,
  obj: GmlObjectRef,
  exclude: Entity,
  visit: (other: Entity, transform: { x: number; y: number }) => void,
): void {
  ctx.scene.each(Transform, (t, other) => {
    if (other.eid === exclude.eid) return;
    if (!objectRefMatches(other, obj)) return;
    visit(other, t);
  });
}

// ---------------------------------------------------------------------------
// instance_exists / instance_number
// ---------------------------------------------------------------------------
//
// Unlike every query above, these two are not "hypothetical position"
// checks at all — no `x`/`y`, no mask, no AABB — just "does at least one
// instance of this type exist anywhere in the scene right now" and "how
// many." They live in this file rather than `gmlActions.ts` because they
// share the exact same object-type resolution (`objectRefMatches`/
// `resolveGmlObjectType`) this file's whole query family is already built
// on, not because they're position-hypothetical the way the rest are.
// Real, confirmed common usage (`if (!instance_exists(obj_guardboss))
// GmlActions.instance_destroy(...)`, from a real project's
// `obj_spikepillar.behavior.ts`) — previously entirely unhandled by this
// importer, a genuine `ReferenceError` at runtime rather than a silent
// no-op, but a real, common, and cleanly implementable gap all the same.
//
// Unlike `eachOtherMatching`, the calling instance itself is never
// excluded — GameMaker's real semantic is "does any instance of this type
// exist," and the caller counts as one if it matches.

/** GML `instance_exists(obj)` — real, honest scene-wide existence check. `all` always returns `true` if the scene has at least one `Transform`-bearing entity; `noone` always returns `false`. */
export function instance_exists(
  entity: Entity,
  ctx: GmlActionContext,
  obj: GmlObjectRef,
): boolean {
  if (obj === "noone") return false;
  if (objectRefMatches(entity, obj)) return true;
  let found = false;
  ctx.scene.each(Transform, (_t, other) => {
    if (found || other.eid === entity.eid) return;
    if (objectRefMatches(other, obj)) found = true;
  });
  return found;
}

/** GML `instance_number(obj)` — real, honest scene-wide count of instances matching `obj`. */
export function instance_number(
  entity: Entity,
  ctx: GmlActionContext,
  obj: GmlObjectRef,
): number {
  if (obj === "noone") return 0;
  let count = objectRefMatches(entity, obj) ? 1 : 0;
  ctx.scene.each(Transform, (_t, other) => {
    if (other.eid === entity.eid) return;
    if (objectRefMatches(other, obj)) count++;
  });
  return count;
}

// ---------------------------------------------------------------------------
// place_meeting / place_free / place_snapped
// ---------------------------------------------------------------------------

/**
 * GameMaker's `place_meeting(x, y, obj)` — true if `entity`'s own collision
 * mask, hypothetically positioned at `(x, y)`, would overlap any instance of
 * `obj`. Does not move `entity` — `entity`'s real `Transform` is never
 * written, only read for its sprite-derived half-extents.
 */
export function place_meeting(
  entity: Entity,
  ctx: GmlActionContext,
  x: number,
  y: number,
  obj: GmlObjectRef,
): boolean {
  const selfExt = spriteHalfExtents(entity);
  let hit = false;
  eachOtherMatching(ctx, obj, entity, (other, t) => {
    if (hit) return;
    const otherExt = spriteHalfExtents(other);
    if (
      aabbOverlap(
        x + selfExt.ox,
        y + selfExt.oy,
        selfExt.x,
        selfExt.y,
        t.x + otherExt.ox,
        t.y + otherExt.oy,
        otherExt.x,
        otherExt.y,
      )
    ) {
      hit = true;
    }
  });
  return hit;
}

/**
 * GameMaker's `place_free(x, y)` — true if `entity`'s mask, hypothetically
 * positioned at `(x, y)`, overlaps no `solid`-flagged instance (GameMaker's
 * real "Solid" object flag — see `Meta.solid`). Unlike `place_meeting`, this
 * checks against every solid instance in the scene, not one named object
 * type.
 */
export function place_free(
  entity: Entity,
  ctx: GmlActionContext,
  x: number,
  y: number,
): boolean {
  const selfExt = spriteHalfExtents(entity);
  let blocked = false;
  ctx.scene.each(Transform, (t, other) => {
    if (blocked) return;
    if (other.eid === entity.eid) return;
    if (!isSolid(other)) return;
    const otherExt = spriteHalfExtents(other);
    if (
      aabbOverlap(
        x + selfExt.ox,
        y + selfExt.oy,
        selfExt.x,
        selfExt.y,
        t.x + otherExt.ox,
        t.y + otherExt.oy,
        otherExt.x,
        otherExt.y,
      )
    ) {
      blocked = true;
    }
  });
  return !blocked;
}

/**
 * GameMaker's `place_snapped(hsnap, vsnap)` — true if `entity`'s *current*
 * position is already grid-aligned. Pure math against the live `Transform`,
 * no scene query and no hypothetical position involved (GameMaker's real
 * signature has no `x`/`y` — it always checks the instance's own current
 * position).
 */
export function place_snapped(
  entity: Entity,
  _ctx: GmlActionContext,
  hsnap: number,
  vsnap: number,
): boolean {
  const transform = entity.get(Transform);
  if (transform === undefined) return false;
  if (hsnap > 0 && transform.x % hsnap !== 0) return false;
  if (vsnap > 0 && transform.y % vsnap !== 0) return false;
  return true;
}

// ---------------------------------------------------------------------------
// position_meeting / position_free / instance_place / instance_position
// ---------------------------------------------------------------------------

/**
 * GameMaker's `position_meeting(x, y, obj)` — true if the single *point*
 * `(x, y)` (not `entity`'s whole mask) is inside an instance of `obj`. The
 * real point-vs-mask distinction from `place_meeting`'s whole-mask check:
 * `entity`'s own extents never factor in here at all.
 */
export function position_meeting(
  entity: Entity,
  ctx: GmlActionContext,
  x: number,
  y: number,
  obj: GmlObjectRef,
): boolean {
  let hit = false;
  eachOtherMatching(ctx, obj, entity, (other, t) => {
    if (hit) return;
    const ext = spriteHalfExtents(other);
    if (pointInAabb(x, y, t.x + ext.ox, t.y + ext.oy, ext.x, ext.y)) hit = true;
  });
  return hit;
}

/** GameMaker's `position_free(x, y)` — true if the point `(x, y)` has no `solid`-flagged instance under it. */
export function position_free(
  entity: Entity,
  ctx: GmlActionContext,
  x: number,
  y: number,
): boolean {
  let blocked = false;
  ctx.scene.each(Transform, (t, other) => {
    if (blocked) return;
    if (other.eid === entity.eid) return;
    if (!isSolid(other)) return;
    const ext = spriteHalfExtents(other);
    if (pointInAabb(x, y, t.x + ext.ox, t.y + ext.oy, ext.x, ext.y))
      blocked = true;
  });
  return !blocked;
}

/**
 * GameMaker's `instance_place(x, y, obj)` — like `place_meeting` but returns
 * the actual first colliding instance (GameMaker's own `noone` on no match,
 * represented here as `undefined`), in scene-iteration order.
 */
export function instance_place(
  entity: Entity,
  ctx: GmlActionContext,
  x: number,
  y: number,
  obj: GmlObjectRef,
): Entity | undefined {
  const selfExt = spriteHalfExtents(entity);
  let found: Entity | undefined;
  eachOtherMatching(ctx, obj, entity, (other, t) => {
    if (found !== undefined) return;
    const otherExt = spriteHalfExtents(other);
    if (
      aabbOverlap(
        x + selfExt.ox,
        y + selfExt.oy,
        selfExt.x,
        selfExt.y,
        t.x + otherExt.ox,
        t.y + otherExt.oy,
        otherExt.x,
        otherExt.y,
      )
    ) {
      found = other;
    }
  });
  return found;
}

/** GameMaker's `instance_position(x, y, obj)` — like `position_meeting` but returns the actual instance at that point, or `undefined` (`noone`). */
export function instance_position(
  entity: Entity,
  ctx: GmlActionContext,
  x: number,
  y: number,
  obj: GmlObjectRef,
): Entity | undefined {
  let found: Entity | undefined;
  eachOtherMatching(ctx, obj, entity, (other, t) => {
    if (found !== undefined) return;
    const ext = spriteHalfExtents(other);
    if (pointInAabb(x, y, t.x + ext.ox, t.y + ext.oy, ext.x, ext.y))
      found = other;
  });
  return found;
}

// ---------------------------------------------------------------------------
// collision_rectangle / collision_circle / collision_line / collision_point
// ---------------------------------------------------------------------------
//
// GameMaker's general collision-shape-query family: an arbitrary shape
// (given in absolute room coordinates, independent of `entity`'s own
// position/mask) against instances of `obj`, with `prec` (always a no-op
// here — no pixel-mask data exists, see module doc comment) and `notme`
// (exclude the calling instance from the results — defaults to GameMaker's
// own default of `true`).

/** GameMaker's `collision_rectangle(x1, y1, x2, y2, obj, prec, notme)` — first instance of `obj` overlapping the given rectangle, or `undefined` (`noone`). `prec` is accepted for signature fidelity but always falls back to bbox checking. */
export function collision_rectangle(
  entity: Entity,
  ctx: GmlActionContext,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  obj: GmlObjectRef,
  _prec = false,
  notme = true,
): Entity | undefined {
  const rx1 = Math.min(x1, x2);
  const rx2 = Math.max(x1, x2);
  const ry1 = Math.min(y1, y2);
  const ry2 = Math.max(y1, y2);
  let found: Entity | undefined;
  ctx.scene.each(Transform, (t, other) => {
    if (found !== undefined) return;
    if (notme && other.eid === entity.eid) return;
    if (!objectRefMatches(other, obj)) return;
    const ext = spriteHalfExtents(other);
    if (
      rectOverlapsAabb(
        rx1,
        ry1,
        rx2,
        ry2,
        t.x + ext.ox,
        t.y + ext.oy,
        ext.x,
        ext.y,
      )
    )
      found = other;
  });
  return found;
}

/** GameMaker's `collision_circle(x, y, radius, obj, prec, notme)` — first instance of `obj` overlapping the given circle, or `undefined` (`noone`). */
export function collision_circle(
  entity: Entity,
  ctx: GmlActionContext,
  x: number,
  y: number,
  radius: number,
  obj: GmlObjectRef,
  _prec = false,
  notme = true,
): Entity | undefined {
  let found: Entity | undefined;
  ctx.scene.each(Transform, (t, other) => {
    if (found !== undefined) return;
    if (notme && other.eid === entity.eid) return;
    if (!objectRefMatches(other, obj)) return;
    const ext = spriteHalfExtents(other);
    if (
      circleOverlapsAabb(x, y, radius, t.x + ext.ox, t.y + ext.oy, ext.x, ext.y)
    )
      found = other;
  });
  return found;
}

/** GameMaker's `collision_line(x1, y1, x2, y2, obj, prec, notme)` — first instance of `obj` whose mask the given line segment crosses, or `undefined` (`noone`). */
export function collision_line(
  entity: Entity,
  ctx: GmlActionContext,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  obj: GmlObjectRef,
  _prec = false,
  notme = true,
): Entity | undefined {
  let found: Entity | undefined;
  ctx.scene.each(Transform, (t, other) => {
    if (found !== undefined) return;
    if (notme && other.eid === entity.eid) return;
    if (!objectRefMatches(other, obj)) return;
    const ext = spriteHalfExtents(other);
    if (
      segmentOverlapsAabb(
        x1,
        y1,
        x2,
        y2,
        t.x + ext.ox,
        t.y + ext.oy,
        ext.x,
        ext.y,
      )
    )
      found = other;
  });
  return found;
}

/** GameMaker's `collision_point(x, y, obj, prec, notme)` — first instance of `obj` whose mask contains the given point, or `undefined` (`noone`). */
export function collision_point(
  entity: Entity,
  ctx: GmlActionContext,
  x: number,
  y: number,
  obj: GmlObjectRef,
  _prec = false,
  notme = true,
): Entity | undefined {
  let found: Entity | undefined;
  ctx.scene.each(Transform, (t, other) => {
    if (found !== undefined) return;
    if (notme && other.eid === entity.eid) return;
    if (!objectRefMatches(other, obj)) return;
    const ext = spriteHalfExtents(other);
    if (pointInAabb(x, y, t.x + ext.ox, t.y + ext.oy, ext.x, ext.y))
      found = other;
  });
  return found;
}

// gmlProjection.ts — GameMaker's legacy `d3d_*` pseudo-3D projection compat
// layer.
//
// Sibling to `gmlActions.ts`/`gmlCamera.ts`/`gmlParticles.ts` — same
// directory, same "engine defines the context shape and the compat
// functions, game code wires the live rendering piece in" pattern, and same
// `(entity, ctx, ...gmlArgs)` signature `gmlActions.ts` established (every
// function here is entity-affecting: it sets *this* entity's projected
// corners, the same way `action_sprite_set` writes *this* entity's `Sprite`
// fields).
//
// Research decision (RELEASE_PASS.md's 2026-09-24 multi-camera/pseudo-3D
// entry), recorded here rather than only in the commit message: real old
// GameMaker "fake 3D" content overwhelmingly uses the legacy pre-2.3
// `d3d_transform_*`/`d3d_set_projection_*` family (a per-instance world
// transform plus a room-wide ortho/perspective projection setter), not the
// modern `camera_set_proj_mat` 4x4-matrix API — that's the family this file
// targets. GameMaker's real `d3d_transform_set_*` functions **replace** the
// current world matrix (they are `_set_`, not `_add_`); this compat layer
// mirrors that "replace, don't accumulate" semantic exactly — see each
// function's doc comment.
//
// **What this is not**: a real 4x4 model/view/projection pipeline. This
// engine renders 2D sprites through pixi.js's `PerspectiveMesh` — a 2D mesh
// with a UV-level perspective correction across four corner points (see
// `PerspectiveMesh`'s own doc comment: "This is not a full 3D mesh, it is a
// 2D mesh with a perspective projection applied to it"), so every function
// below ultimately just computes four `(x, y)` corners and writes them onto
// the entity's `Projection3D` component. `d3d_transform_set_rotation_x`/`_y`
// (real GameMaker: rotation about the horizontal/vertical axis, i.e. tilt
// toward/away from the viewer) has no literal analogue in a four-corner 2D
// mesh — this compat layer approximates a tilt as a `cos(angle)` edge-width
// shrink (documented per-function below), a real, deterministic,
// hand-verifiable formula, not a fabricated one — but it is an honest
// approximation of "this edge recedes," not a real projection of a rotated
// plane through a camera matrix. `Projection3D`'s own doc comment repeats
// this for anyone who lands on the component first.
//
// No DOM, Tauri, or apps/ide imports — same engine-environment-boundary
// rule as every other file under compat/.

import type { Entity } from "../Entity.js";
import type { World } from "bitecs";
import { Projection3D } from "../components/Projection3D.js";
import { getOrCreate } from "../internal/scoped.js";

/** Default flat quad size (pixels) used by `d3d_transform_set_*` when no prior `d3d_set_projection_*` call on this entity established a base size — matches `PerspectiveMesh.defaultOptions`' own 100x100 default, so an entity that only ever calls `d3d_transform_set_rotation_z` (say) still gets a sensibly-sized quad. */
const DEFAULT_QUAD_SIZE = 100;

/** Per-entity working state for the base (untransformed) quad a `d3d_transform_set_*` call transforms. Distinct from `Projection3D`'s own fields (the *result*, read every frame by `RenderPipeline`) for the same "component holds the derived result, a side-table holds the mutable working state" split `Projection3D`'s doc comment describes. */
interface QuadState {
  width: number;
  height: number;
}

const quadByWorld = new WeakMap<World, Map<number, QuadState>>();

function ensureQuad(entity: Entity): QuadState {
  const perWorld = getOrCreate(quadByWorld, entity.world, () => new Map());
  let state = perWorld.get(entity.eid);
  if (state === undefined) {
    state = { width: DEFAULT_QUAD_SIZE, height: DEFAULT_QUAD_SIZE };
    perWorld.set(entity.eid, state);
  }
  return state;
}

/** Clears this entity's stored base-quad state. Call from `Scene.destroy()`-adjacent teardown for any entity that used the `d3d_transform_*` family — same pooled-id-reuse reasoning as every other per-`(World, eid)` side-table in this codebase (`PhysicsBody`'s callbacks, `VisualScriptState`'s scope, `gmlActions.ts`'s alarms). @internal exposed for tests and for a future `Scene.destroy()` wiring pass. */
export function clearGmlProjectionState(entity: Entity): void {
  quadByWorld.get(entity.world)?.delete(entity.eid);
}

function writeCorners(
  entity: Entity,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
): void {
  if (!entity.has(Projection3D)) entity.add(Projection3D);
  const proj = entity.get(Projection3D);
  if (proj === undefined) return;
  proj.active = true;
  proj.x0 = x0;
  proj.y0 = y0;
  proj.x1 = x1;
  proj.y1 = y1;
  proj.x2 = x2;
  proj.y2 = y2;
  proj.x3 = x3;
  proj.y3 = y3;
}

/** Rotate a point `(px, py)` about pivot `(cx, cy)` by `angleRad` radians (standard 2D rotation matrix — clockwise-positive to match GameMaker's own screen-space angle convention, the same one `gml.ts`'s `lengthdir_x`/`lengthdir_y` and `gmlCamera.ts`'s view angle already use). */
function rotateAround(
  px: number,
  py: number,
  cx: number,
  cy: number,
  angleRad: number,
): { x: number; y: number } {
  const dx = px - cx;
  const dy = py - cy;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}

// ---------------------------------------------------------------------------
// d3d_set_projection_ortho / d3d_set_projection_perspective
// ---------------------------------------------------------------------------

/**
 * `d3d_set_projection_ortho(x, y, w, h, angle)` — real GameMaker sets an
 * orthographic (no perspective distortion) view over the given screen
 * rectangle, optionally rotated by `angle` degrees. With no perspective
 * term at all, this is exactly an axis-aligned rectangle rotated about its
 * own centre — a plain, exactly-verifiable rotation, no approximation
 * involved. Also records `(w, h)` as this entity's base quad size for any
 * later `d3d_transform_set_*` call.
 */
export function d3d_set_projection_ortho(
  entity: Entity,
  x: number,
  y: number,
  width: number,
  height: number,
  angleDegrees = 0,
): void {
  const quad = ensureQuad(entity);
  quad.width = width;
  quad.height = height;

  const angleRad = (angleDegrees * Math.PI) / 180;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const c0 = rotateAround(x, y, cx, cy, angleRad);
  const c1 = rotateAround(x + width, y, cx, cy, angleRad);
  const c2 = rotateAround(x + width, y + height, cx, cy, angleRad);
  const c3 = rotateAround(x, y + height, cx, cy, angleRad);
  writeCorners(entity, c0.x, c0.y, c1.x, c1.y, c2.x, c2.y, c3.x, c3.y);
}

/**
 * `d3d_set_projection_perspective(x, y, w, h, angle)` — GameMaker's real
 * function takes an eye position/look-at/up vector triple, i.e. a genuine 3D
 * camera; a four-corner 2D mesh has no such input space. This compat layer
 * approximates "looking down a receding plane" the way a top-down/isometric
 * GML game actually uses it: the far (top) edge is narrowed to
 * `PERSPECTIVE_FAR_SCALE` of the near (bottom) edge's width and centred
 * above it, producing a trapezoid — the standard "railroad tracks converging
 * toward a horizon" shape a real perspective projection of a flat ground
 * plane produces. `PERSPECTIVE_FAR_SCALE` is a fixed, documented constant
 * (not derived per-call from a fov/near/far the caller can't meaningfully
 * supply here), so the resulting corner maths is exactly reproducible and
 * hand-verifiable — see `gmlProjection.test.ts`.
 */
const PERSPECTIVE_FAR_SCALE = 0.5;

export function d3d_set_projection_perspective(
  entity: Entity,
  x: number,
  y: number,
  width: number,
  height: number,
  angleDegrees = 0,
): void {
  const quad = ensureQuad(entity);
  quad.width = width;
  quad.height = height;

  const inset = (width * (1 - PERSPECTIVE_FAR_SCALE)) / 2;
  // Unrotated trapezoid: near edge (bottom, y+height) full width, far edge
  // (top, y) narrowed and centred.
  const rawX0 = x + inset;
  const rawY0 = y;
  const rawX1 = x + width - inset;
  const rawY1 = y;
  const rawX2 = x + width;
  const rawY2 = y + height;
  const rawX3 = x;
  const rawY3 = y + height;

  const angleRad = (angleDegrees * Math.PI) / 180;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const c0 = rotateAround(rawX0, rawY0, cx, cy, angleRad);
  const c1 = rotateAround(rawX1, rawY1, cx, cy, angleRad);
  const c2 = rotateAround(rawX2, rawY2, cx, cy, angleRad);
  const c3 = rotateAround(rawX3, rawY3, cx, cy, angleRad);
  writeCorners(entity, c0.x, c0.y, c1.x, c1.y, c2.x, c2.y, c3.x, c3.y);
}

// ---------------------------------------------------------------------------
// d3d_transform_set_* — the per-instance world transform family
// ---------------------------------------------------------------------------

/** `d3d_transform_set_identity()` — resets this entity's projection to a plain, untilted, centred quad at the origin using its last-known base size (or the 100x100 default) — exactly `PerspectiveMesh.defaultOptions`'s own untransformed square. */
export function d3d_transform_set_identity(entity: Entity): void {
  const quad = ensureQuad(entity);
  writeCorners(
    entity,
    0,
    0,
    quad.width,
    0,
    quad.width,
    quad.height,
    0,
    quad.height,
  );
}

/**
 * `d3d_transform_set_translation(x, y, z)` — real GameMaker replaces the
 * world matrix with a pure translation. This compat layer's mesh has no
 * depth axis to place `z` on, so `z` is accepted (for call-signature
 * compatibility with real GML source) but does not affect the corners — an
 * honest, documented gap rather than an invented z-to-scale conversion.
 * Moves this entity's base quad (top-left origin) by `(x, y)`.
 */
export function d3d_transform_set_translation(
  entity: Entity,
  x: number,
  y: number,
  _z = 0,
): void {
  const quad = ensureQuad(entity);
  writeCorners(
    entity,
    x,
    y,
    x + quad.width,
    y,
    x + quad.width,
    y + quad.height,
    x,
    y + quad.height,
  );
}

/** `d3d_transform_set_rotation_z(angle)` — a real, exact in-plane rotation of this entity's base quad about its own centre by `angle` degrees (GameMaker's own screen-space-angle convention — see `rotateAround`'s doc comment). This is the one rotation axis a 2D corner mesh represents exactly, with no approximation. */
export function d3d_transform_set_rotation_z(
  entity: Entity,
  angleDegrees: number,
): void {
  const quad = ensureQuad(entity);
  const angleRad = (angleDegrees * Math.PI) / 180;
  const cx = quad.width / 2;
  const cy = quad.height / 2;
  const c0 = rotateAround(0, 0, cx, cy, angleRad);
  const c1 = rotateAround(quad.width, 0, cx, cy, angleRad);
  const c2 = rotateAround(quad.width, quad.height, cx, cy, angleRad);
  const c3 = rotateAround(0, quad.height, cx, cy, angleRad);
  writeCorners(entity, c0.x, c0.y, c1.x, c1.y, c2.x, c2.y, c3.x, c3.y);
}

/**
 * `d3d_transform_set_rotation_x(angle)` — real GameMaker: rotates the world
 * matrix about the horizontal (X) axis, tilting the plane's top edge toward
 * or away from the viewer. Approximated here as a `cos(angle)` shrink of the
 * top edge's width, centred — `cos(0) = 1` (untilted, exact rectangle),
 * `cos(90°) = 0` (top edge collapses to a point, the plane viewed edge-on) —
 * a real, deterministic, hand-verifiable trig formula for the one thing a
 * flat four-corner mesh *can* represent about an X-axis tilt (foreshortening
 * of the far edge), not a claim of matching GameMaker's real 3D matrix
 * output.
 */
export function d3d_transform_set_rotation_x(
  entity: Entity,
  angleDegrees: number,
): void {
  const quad = ensureQuad(entity);
  const angleRad = (angleDegrees * Math.PI) / 180;
  const shrink = Math.abs(Math.cos(angleRad));
  const inset = (quad.width * (1 - shrink)) / 2;
  writeCorners(
    entity,
    inset,
    0,
    quad.width - inset,
    0,
    quad.width,
    quad.height,
    0,
    quad.height,
  );
}

/** `d3d_transform_set_rotation_y(angle)` — the vertical-axis twin of `d3d_transform_set_rotation_x`, same `cos(angle)` shrink formula applied to the left/right edges instead of top/bottom. */
export function d3d_transform_set_rotation_y(
  entity: Entity,
  angleDegrees: number,
): void {
  const quad = ensureQuad(entity);
  const angleRad = (angleDegrees * Math.PI) / 180;
  const shrink = Math.abs(Math.cos(angleRad));
  const inset = (quad.height * (1 - shrink)) / 2;
  writeCorners(
    entity,
    0,
    inset,
    quad.width,
    0,
    quad.width,
    quad.height,
    0,
    quad.height - inset,
  );
}

/** `d3d_transform_set_scaling(xs, ys, zs)` — scales this entity's base quad about the origin corner (top-left), matching a real GameMaker scale matrix applied before any translation. `zs` is accepted (call-signature compatibility) but unused, for the same reason `d3d_transform_set_translation`'s `z` is. */
export function d3d_transform_set_scaling(
  entity: Entity,
  xs: number,
  ys: number,
  _zs = 1,
): void {
  const quad = ensureQuad(entity);
  const w = quad.width * xs;
  const h = quad.height * ys;
  writeCorners(entity, 0, 0, w, 0, w, h, 0, h);
}

/** `d3d_transform_set_identity`'s inverse operation for cleanup: turns projected rendering back off for this entity, reverting `RenderPipeline`'s sprite-sync to the plain `Sprite` path. Not a real GameMaker function — a convenience this compat layer adds since GML itself has no single call that means "stop being pseudo-3D," it just stops calling `d3d_transform_set_*`/`d3d_set_projection_*` for that instance. */
export function d3d_transform_clear(entity: Entity): void {
  if (!entity.has(Projection3D)) return;
  const proj = entity.get(Projection3D);
  if (proj === undefined) return;
  proj.active = false;
}

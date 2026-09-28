import type { Entity } from "../Entity.js";
/**
 * `d3d_set_projection_ortho(x, y, w, h, angle)` — real GameMaker sets an
 * orthographic (no perspective distortion) view over the given screen
 * rectangle, optionally rotated by `angle` degrees. With no perspective
 * term at all, this is exactly an axis-aligned rectangle rotated about its
 * own centre — a plain, exactly-verifiable rotation, no approximation
 * involved. Also records `(w, h)` as this entity's base quad size for any
 * later `d3d_transform_set_*` call.
 */
export declare function d3d_set_projection_ortho(
  entity: Entity,
  x: number,
  y: number,
  width: number,
  height: number,
  angleDegrees?: number,
): void;
export declare function d3d_set_projection_perspective(
  entity: Entity,
  x: number,
  y: number,
  width: number,
  height: number,
  angleDegrees?: number,
): void;
/** `d3d_transform_set_identity()` — resets this entity's projection to a plain, untilted, centred quad at the origin using its last-known base size (or the 100x100 default) — exactly `PerspectiveMesh.defaultOptions`'s own untransformed square. */
export declare function d3d_transform_set_identity(entity: Entity): void;
/**
 * `d3d_transform_set_translation(x, y, z)` — real GameMaker replaces the
 * world matrix with a pure translation. This compat layer's mesh has no
 * depth axis to place `z` on, so `z` is accepted (for call-signature
 * compatibility with real GML source) but does not affect the corners — an
 * honest, documented gap rather than an invented z-to-scale conversion.
 * Moves this entity's base quad (top-left origin) by `(x, y)`.
 */
export declare function d3d_transform_set_translation(
  entity: Entity,
  x: number,
  y: number,
  _z?: number,
): void;
/** `d3d_transform_set_rotation_z(angle)` — a real, exact in-plane rotation of this entity's base quad about its own centre by `angle` degrees (GameMaker's own screen-space-angle convention — see `rotateAround`'s doc comment). This is the one rotation axis a 2D corner mesh represents exactly, with no approximation. */
export declare function d3d_transform_set_rotation_z(
  entity: Entity,
  angleDegrees: number,
): void;
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
export declare function d3d_transform_set_rotation_x(
  entity: Entity,
  angleDegrees: number,
): void;
/** `d3d_transform_set_rotation_y(angle)` — the vertical-axis twin of `d3d_transform_set_rotation_x`, same `cos(angle)` shrink formula applied to the left/right edges instead of top/bottom. */
export declare function d3d_transform_set_rotation_y(
  entity: Entity,
  angleDegrees: number,
): void;
/** `d3d_transform_set_scaling(xs, ys, zs)` — scales this entity's base quad about the origin corner (top-left), matching a real GameMaker scale matrix applied before any translation. `zs` is accepted (call-signature compatibility) but unused, for the same reason `d3d_transform_set_translation`'s `z` is. */
export declare function d3d_transform_set_scaling(
  entity: Entity,
  xs: number,
  ys: number,
  _zs?: number,
): void;
/** `d3d_transform_set_identity`'s inverse operation for cleanup: turns projected rendering back off for this entity, reverting `RenderPipeline`'s sprite-sync to the plain `Sprite` path. Not a real GameMaker function — a convenience this compat layer adds since GML itself has no single call that means "stop being pseudo-3D," it just stops calling `d3d_transform_set_*`/`d3d_set_projection_*` for that instance. */
export declare function d3d_transform_clear(entity: Entity): void;

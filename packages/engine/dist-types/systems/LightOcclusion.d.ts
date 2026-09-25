export interface Point {
  x: number;
  y: number;
}
/** One occluding edge, in world space. */
export interface Segment {
  ax: number;
  ay: number;
  bx: number;
  by: number;
}
/**
 * Computes a light's real visible region given a set of nearby occluder
 * segments, as a polygon in the same world space `origin`/`segments` are
 * given in. `segments` are expected to already be relative to `origin`
 * (i.e. `ax`/`ay`/`bx`/`by` are offsets from the light, not absolute world
 * coordinates) — callers building world-space segments should subtract the
 * light's own position first; this keeps every trig call in this function
 * origin-relative and avoids re-deriving it per ray.
 *
 * Returns `null` when `segments` is empty — the light is fully unoccluded,
 * and the caller should render its ordinary, un-masked circular falloff
 * (this is what keeps "no occluders present" behaviourally identical to the
 * pre-occlusion implementation: nobody has to special-case an "everything
 * visible" polygon shaped like a many-sided circle approximation).
 */
export declare function computeVisibilityPolygon(
  radius: number,
  segments: readonly Segment[],
  raySamples?: number,
): Point[] | null;
/**
 * Even-odd point-in-polygon test (ray casting). Exported for tests that
 * want to assert "this world point is/isn't actually lit" against a
 * computed visibility polygon, and available to any future caller that
 * needs the same check (e.g. a gameplay query like "is the player in the
 * dark").
 */
export declare function pointInPolygon(
  point: Point,
  polygon: readonly Point[],
): boolean;
/**
 * Axis-aligned-box occluder → its four edges as world-space segments. A
 * `LightOccluder` is always a plain axis-aligned rectangle (no rotation
 * field) — see `components/LightOccluder.ts`'s doc comment for why that's
 * an honest, deliberate limitation rather than an oversight.
 */
export declare function boxOccluderSegments(
  centreX: number,
  centreY: number,
  width: number,
  height: number,
): Segment[];
/**
 * True when a box occluder (centre + half-extents) could plausibly matter to
 * a light of the given radius, via the standard AABB-vs-circle distance
 * test (clamp the circle centre into the box, measure the remaining
 * distance). This is the spatial-culling pass `collectLights()` runs before
 * doing any per-ray work — the minimum bar CLAUDE.md's own perf-honesty
 * convention (e.g. `renderMultiCamera()`'s doc comment) asks new N-ish-cost
 * rendering paths to clear.
 */
export declare function boxWithinReach(
  lightX: number,
  lightY: number,
  radius: number,
  centreX: number,
  centreY: number,
  width: number,
  height: number,
): boolean;

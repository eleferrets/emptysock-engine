// Pure 2D visibility-polygon geometry for shadow-casting point lights. No
// pixi import here — this stays inside the engine environment boundary
// (Node/browser/Tauri all run it), same as LightingSystem.ts itself. The
// actual pixels (masking a light's radial-gradient Graphics with the
// polygon this file computes) live in RenderSystem.syncLighting().
//
// Technique: the standard "visibility polygon from occluder segment
// endpoints" algorithm (see e.g. Red Blob Games' "2D Visibility" writeup,
// and the classic Copperlicht/Trung Le / Amit Patel treatment of the same
// problem) — cast a ray from the light's centre at the angle of every
// occluder-segment endpoint (plus a hair before/after each one, so a ray
// grazing a corner samples both the near and far side of it), find the
// *closest* segment intersection along each ray (clipped to the light's own
// radius, which acts as the light's own natural "far clip"), and connect the
// hit points in angle order. Between occluders (no nearby geometry) this
// alone would draw straight chords across the light's circular falloff
// instead of a smooth arc, so a configurable number of evenly-spaced angle
// samples around the full circle are unioned into the same angle list — the
// same "sample extra directions so a polygon can approximate a curve"
// approach any of these writeups uses for a light with no occluders in a
// given arc.
//
// This is a real, checkable computation, not a rough "looks a bit like
// shadows" approximation — LightOcclusion.test.ts asserts point-in-polygon
// results against hand-worked-out expected shadow regions, not just "did
// not throw".

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

const CORNER_EPSILON = 1e-4;

/**
 * Ray/segment intersection via the standard cross-product parametrisation
 * (`t` = distance along the ray, `u` = position along the segment, 0..1).
 * Returns `null` for a parallel ray/segment pair (including the collinear
 * case — treated as "no blocking intersection", an acceptable
 * approximation: a ray running exactly along an occluder's own edge
 * contributes no visible area either way) or when the intersection falls
 * behind the ray's origin or outside the segment's own span.
 */
function raySegmentIntersection(
  originX: number,
  originY: number,
  dirX: number,
  dirY: number,
  seg: Segment,
): number | null {
  const sx = seg.bx - seg.ax;
  const sy = seg.by - seg.ay;
  const rxs = dirX * sy - dirY * sx;
  if (rxs === 0) return null;

  const qpx = seg.ax - originX;
  const qpy = seg.ay - originY;
  const t = (qpx * sy - qpy * sx) / rxs;
  const u = (qpx * dirY - qpy * dirX) / rxs;

  if (t < 0 || u < 0 || u > 1) return null;
  return t;
}

/**
 * Every angle a ray needs to be cast at: one per occluder-segment endpoint
 * (each with the corner-grazing epsilon pair either side), plus `raySamples`
 * angles evenly spaced around the full circle to keep an occluder-free arc
 * looking like an arc rather than a polygon chord. Deduplicated and sorted
 * ascending.
 *
 * When `coneStart`/`coneEnd` are given (a spot light — see
 * `computeVisibilityPolygon`'s doc comment), every angle outside
 * `[coneStart, coneEnd]` is dropped and the two cone-edge angles themselves
 * are added, so the returned list only ever spans the cone's own wedge.
 */
function buildAngleList(
  segments: readonly Segment[],
  raySamples: number,
  coneStart?: number,
  coneEnd?: number,
): number[] {
  const angles = new Set<number>();
  const inCone = (a: number): boolean =>
    coneStart === undefined || coneEnd === undefined
      ? true
      : a >= coneStart && a <= coneEnd;

  for (const seg of segments) {
    const a1 = Math.atan2(seg.ay, seg.ax);
    const a2 = Math.atan2(seg.by, seg.bx);
    for (const a of [a1, a2]) {
      for (const candidate of [a, a - CORNER_EPSILON, a + CORNER_EPSILON]) {
        if (inCone(candidate)) angles.add(candidate);
      }
    }
  }

  if (coneStart !== undefined && coneEnd !== undefined) {
    angles.add(coneStart);
    angles.add(coneEnd);
    const samples = Math.max(2, raySamples);
    for (let i = 0; i <= samples; i++) {
      angles.add(coneStart + (i / samples) * (coneEnd - coneStart));
    }
  } else {
    const samples = Math.max(3, raySamples);
    for (let i = 0; i < samples; i++) {
      angles.add((i / samples) * Math.PI * 2 - Math.PI);
    }
  }

  return Array.from(angles).sort((a, b) => a - b);
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
 * Returns `null` when `segments` is empty and `cone` is not given — the
 * light is fully unoccluded, and the caller should render its ordinary,
 * un-masked circular falloff (this is what keeps "no occluders present"
 * behaviourally identical to the pre-occlusion implementation: nobody has
 * to special-case an "everything visible" polygon shaped like a many-sided
 * circle approximation).
 *
 * `cone`, when given, restricts the light to a spot/cone wedge —
 * `direction`/`angle` in radians, the wedge spanning
 * `[direction - angle/2, direction + angle/2]`. A cone light always returns
 * a real polygon (never `null`, even with zero occluders) since a wedge is
 * never "the ordinary un-masked circle" — the returned polygon is a real
 * pie-slice: the origin `(0, 0)` itself (the light's own position, in the
 * same origin-relative space every other point here is in) is included as
 * the first and last vertex so the two straight cone edges are part of the
 * polygon, not just its arc.
 */
export function computeVisibilityPolygon(
  radius: number,
  segments: readonly Segment[],
  raySamples = 32,
  cone?: { direction: number; angle: number },
): Point[] | null {
  const isCone = cone !== undefined && cone.angle < Math.PI * 2 - 1e-6;
  if (!isCone && segments.length === 0) return null;

  const coneStart = isCone ? cone.direction - cone.angle / 2 : undefined;
  const coneEnd = isCone ? cone.direction + cone.angle / 2 : undefined;
  const angles = buildAngleList(segments, raySamples, coneStart, coneEnd);
  const points: Point[] = [];

  if (isCone) points.push({ x: 0, y: 0 });

  for (const angle of angles) {
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);

    let closest = radius;
    for (const seg of segments) {
      const t = raySegmentIntersection(0, 0, dirX, dirY, seg);
      if (t !== null && t < closest) closest = t;
    }

    points.push({ x: dirX * closest, y: dirY * closest });
  }

  if (isCone) points.push({ x: 0, y: 0 });

  return points;
}

/**
 * Even-odd point-in-polygon test (ray casting). Exported for tests that
 * want to assert "this world point is/isn't actually lit" against a
 * computed visibility polygon, and available to any future caller that
 * needs the same check (e.g. a gameplay query like "is the player in the
 * dark").
 */
export function pointInPolygon(
  point: Point,
  polygon: readonly Point[],
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i];
    const pj = polygon[j];
    if (pi === undefined || pj === undefined) continue;
    const intersects =
      pi.y > point.y !== pj.y > point.y &&
      point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y) + pi.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Axis-aligned-box occluder → its four edges as world-space segments. A
 * `LightOccluder` is always a plain axis-aligned rectangle (no rotation
 * field) — see `components/LightOccluder.ts`'s doc comment for why that's
 * an honest, deliberate limitation rather than an oversight.
 */
export function boxOccluderSegments(
  centreX: number,
  centreY: number,
  width: number,
  height: number,
): Segment[] {
  const hw = width / 2;
  const hh = height / 2;
  const left = centreX - hw;
  const right = centreX + hw;
  const top = centreY - hh;
  const bottom = centreY + hh;

  return [
    { ax: left, ay: top, bx: right, by: top },
    { ax: right, ay: top, bx: right, by: bottom },
    { ax: right, ay: bottom, bx: left, by: bottom },
    { ax: left, ay: bottom, bx: left, by: top },
  ];
}

/**
 * True when a box occluder (centre + half-extents) could plausibly matter to
 * a light of the given radius, via the standard AABB-vs-circle distance
 * test (clamp the circle centre into the box, measure the remaining
 * distance). This is the spatial-culling pass `collectLights()` runs before
 * doing any per-ray work — the minimum bar CLAUDE.md's own perf-honesty
 * convention (e.g. `renderMultiCamera()`'s doc comment) asks new N-ish-cost
 * rendering paths to clear.
 */
export function boxWithinReach(
  lightX: number,
  lightY: number,
  radius: number,
  centreX: number,
  centreY: number,
  width: number,
  height: number,
): boolean {
  const hw = width / 2;
  const hh = height / 2;
  const closestX = Math.max(centreX - hw, Math.min(lightX, centreX + hw));
  const closestY = Math.max(centreY - hh, Math.min(lightY, centreY + hh));
  const dx = lightX - closestX;
  const dy = lightY - closestY;
  return dx * dx + dy * dy <= radius * radius;
}

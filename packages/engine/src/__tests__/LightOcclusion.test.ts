import { describe, expect, it } from "vitest";
import {
  boxOccluderSegments,
  boxWithinReach,
  computeVisibilityPolygon,
  pointInPolygon,
  type Point,
  type Segment,
} from "../systems/LightOcclusion.js";

/** No-non-null-assertion-safe "this test expects a real polygon" accessor. */
function requirePolygon(polygon: Point[] | null): Point[] {
  if (polygon === null) throw new Error("expected a visibility polygon");
  return polygon;
}

describe("computeVisibilityPolygon", () => {
  it("returns null with no occluder segments (caller falls back to the un-masked circle)", () => {
    expect(computeVisibilityPolygon(100, [])).toBeNull();
  });

  it("a point directly behind a single-segment occluder is NOT visible", () => {
    // Light at the origin. A vertical wall segment 40px in front of it
    // (x = 50, from y = -100 to y = 100), given relative to the light per
    // computeVisibilityPolygon's contract.
    const segments: Segment[] = [{ ax: 50, ay: -100, bx: 50, by: 100 }];
    const polygon = requirePolygon(computeVisibilityPolygon(200, segments, 64));

    // Straight-line-behind point, in light-relative coordinates: x = 150, y = 0.
    expect(pointInPolygon({ x: 150, y: 0 }, polygon)).toBe(false);
  });

  it("a point beside (outside) the same occluder's shadow IS visible", () => {
    const segments: Segment[] = [{ ax: 50, ay: -100, bx: 50, by: 100 }];
    const polygon = requirePolygon(computeVisibilityPolygon(200, segments, 64));

    // Well outside the wall's y-span (wall only spans y in [-100, 100]),
    // at the same radius the wall sits at — nothing blocks this ray.
    expect(pointInPolygon({ x: 50, y: 150 }, polygon)).toBe(true);
  });

  it("a point in front of the occluder (nearer than it) is visible", () => {
    const segments: Segment[] = [{ ax: 50, ay: -100, bx: 50, by: 100 }];
    const polygon = requirePolygon(computeVisibilityPolygon(200, segments, 64));

    expect(pointInPolygon({ x: 25, y: 0 }, polygon)).toBe(true);
  });

  it("light close enough to a short occluder illuminates the area beyond its ends", () => {
    // A short wall (only 20px tall, y in [-10, 10]) 30px away — well short
    // of the light's own radius, so it can't shadow the whole far side.
    const segments: Segment[] = [{ ax: 30, ay: -10, bx: 30, by: 10 }];
    const polygon = requirePolygon(computeVisibilityPolygon(150, segments, 64));

    // Directly behind the short wall: not visible.
    expect(pointInPolygon({ x: 100, y: 0 }, polygon)).toBe(false);
    // Past the wall's ends, but on the far side (wrap-around) — visible,
    // since nothing in the segment list blocks a ray to it.
    expect(pointInPolygon({ x: 100, y: 80 }, polygon)).toBe(true);
    expect(pointInPolygon({ x: 100, y: -80 }, polygon)).toBe(true);
  });

  it("a box occluder blocks the point directly behind its near face", () => {
    const segs = boxOccluderSegments(100, 0, 20, 200); // centred at (100,0)
    // Light-relative: same as world here since light sits at the origin.
    const polygon = requirePolygon(computeVisibilityPolygon(300, segs, 64));

    expect(pointInPolygon({ x: 250, y: 0 }, polygon)).toBe(false);
    expect(pointInPolygon({ x: 100, y: 200 }, polygon)).toBe(true);
  });
});

describe("boxWithinReach", () => {
  it("true for a box that overlaps the light's radius", () => {
    expect(boxWithinReach(0, 0, 100, 50, 0, 20, 20)).toBe(true);
  });

  it("false for a box entirely outside the light's radius", () => {
    expect(boxWithinReach(0, 0, 100, 500, 0, 20, 20)).toBe(false);
  });

  it("true when the light centre is inside the box", () => {
    expect(boxWithinReach(10, 10, 50, 0, 0, 100, 100)).toBe(true);
  });
});

describe("computeVisibilityPolygon — cone/spot lights", () => {
  it("a 90-degree cone facing +X (direction 0) never covers a point directly behind it (-X)", () => {
    const polygon = requirePolygon(
      computeVisibilityPolygon(200, [], 32, {
        direction: 0,
        angle: Math.PI / 2,
      }),
    );
    expect(pointInPolygon({ x: -150, y: 0 }, polygon)).toBe(false);
  });

  it("that same cone DOES cover a point straight ahead, within its own radius", () => {
    const polygon = requirePolygon(
      computeVisibilityPolygon(200, [], 32, {
        direction: 0,
        angle: Math.PI / 2,
      }),
    );
    expect(pointInPolygon({ x: 100, y: 0 }, polygon)).toBe(true);
  });

  it("a narrow cone excludes a point just outside its own half-angle", () => {
    // 30-degree wide cone facing +X (=/- 15 degrees). A point at 45 degrees
    // off-axis, well within radius, must be excluded.
    const polygon = requirePolygon(
      computeVisibilityPolygon(200, [], 64, {
        direction: 0,
        angle: (30 * Math.PI) / 180,
      }),
    );
    const angle = (45 * Math.PI) / 180;
    const point = { x: Math.cos(angle) * 100, y: Math.sin(angle) * 100 };
    expect(pointInPolygon(point, polygon)).toBe(false);
  });

  it("a cone with angle >= 360 degrees (2*PI) is treated as an ordinary point light — returns null with no occluders", () => {
    expect(
      computeVisibilityPolygon(200, [], 32, {
        direction: 0,
        angle: Math.PI * 2,
      }),
    ).toBeNull();
  });

  it("a cone still respects real occlusion within its own wedge", () => {
    // Wall directly ahead (+X) of a cone that's pointed at +X.
    const segments: Segment[] = [{ ax: 50, ay: -100, bx: 50, by: 100 }];
    const polygon = requirePolygon(
      computeVisibilityPolygon(200, segments, 64, {
        direction: 0,
        angle: Math.PI / 2,
      }),
    );
    expect(pointInPolygon({ x: 150, y: 0 }, polygon)).toBe(false);
  });
});

describe("boxOccluderSegments", () => {
  it("produces four edges forming the expected rectangle", () => {
    const segs = boxOccluderSegments(0, 0, 10, 20);
    expect(segs).toHaveLength(4);
    const xs = segs.flatMap((s) => [s.ax, s.bx]);
    const ys = segs.flatMap((s) => [s.ay, s.by]);
    expect(Math.min(...xs)).toBe(-5);
    expect(Math.max(...xs)).toBe(5);
    expect(Math.min(...ys)).toBe(-10);
    expect(Math.max(...ys)).toBe(10);
  });
});

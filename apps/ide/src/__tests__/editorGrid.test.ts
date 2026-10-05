import { describe, it, expect } from "vitest";
import {
  snapToGrid,
  snapPoint,
  getRulerMetrics,
  computeAlignmentGuides,
  makeGridOverlay,
} from "../lib/editorGrid";

// ---------------------------------------------------------------------------
// snapToGrid — boundary values
// ---------------------------------------------------------------------------
describe("snapToGrid", () => {
  it("snap(0, 32) === 0", () => {
    expect(snapToGrid(0, 32)).toBe(0);
  });

  it("snap(15, 32) === 0 (rounds down below midpoint)", () => {
    expect(snapToGrid(15, 32)).toBe(0);
  });

  it("snap(16, 32) === 32 (rounds up at exact midpoint)", () => {
    expect(snapToGrid(16, 32)).toBe(32);
  });

  it("snap(32, 32) === 32 (exact cell boundary)", () => {
    expect(snapToGrid(32, 32)).toBe(32);
  });

  it("snap(33, 32) === 32 (just above boundary rounds to it)", () => {
    expect(snapToGrid(33, 32)).toBe(32);
  });

  it("snap(48, 32) === 64 (midpoint between 32 and 64)", () => {
    expect(snapToGrid(48, 32)).toBe(64);
  });

  it("handles negative values", () => {
    expect(snapToGrid(-15, 32)).toBe(0);
    expect(snapToGrid(-16, 32)).toBe(-32);
    expect(snapToGrid(-32, 32)).toBe(-32);
  });

  it("works with grid size 16", () => {
    expect(snapToGrid(8, 16)).toBe(16);
    expect(snapToGrid(7, 16)).toBe(0);
  });

  it("works with grid size 1 (identity)", () => {
    expect(snapToGrid(17, 1)).toBe(17);
  });

  it("handles non-integer input", () => {
    // 15.9 / 32 = 0.497 → rounds to 0
    expect(snapToGrid(15.9, 32)).toBe(0);
    // 16.1 / 32 = 0.503 → rounds to 1 → * 32 = 32
    expect(snapToGrid(16.1, 32)).toBe(32);
  });
});

// ---------------------------------------------------------------------------
// snapPoint
// ---------------------------------------------------------------------------
describe("snapPoint", () => {
  it("snaps both axes independently", () => {
    const result = snapPoint(15, 48, 32);
    expect(result.x).toBe(0);
    expect(result.y).toBe(64);
  });

  it("returns origin for (0, 0)", () => {
    const result = snapPoint(0, 0, 32);
    expect(result).toEqual({ x: 0, y: 0 });
  });

  it("snaps a grid-aligned point to itself", () => {
    const result = snapPoint(64, 96, 32);
    expect(result).toEqual({ x: 64, y: 96 });
  });
});

// ---------------------------------------------------------------------------
// getRulerMetrics
// ---------------------------------------------------------------------------
describe("getRulerMetrics", () => {
  it("returns a positive rulerSize", () => {
    const { rulerSize } = getRulerMetrics();
    expect(rulerSize).toBeGreaterThan(0);
  });

  it("rulerSize is consistent across calls", () => {
    expect(getRulerMetrics().rulerSize).toBe(getRulerMetrics().rulerSize);
  });
});

// ---------------------------------------------------------------------------
// computeAlignmentGuides
// ---------------------------------------------------------------------------
describe("computeAlignmentGuides", () => {
  const obj = { left: 100, right: 200, top: 50, bottom: 150, cx: 150, cy: 100 };

  it("returns no guides when refs are empty", () => {
    const guides = computeAlignmentGuides(obj, { x: [], y: [] });
    expect(guides).toHaveLength(0);
  });

  it("returns an x guide when a ref is within snap threshold of the left edge", () => {
    // left = 100, ref = 103 → |100 - 103| = 3 ≤ 6
    const guides = computeAlignmentGuides(obj, { x: [103] });
    expect(guides.some((g) => g.axis === "x" && g.canvasPx === 103)).toBe(true);
  });

  it("returns no guide when ref is outside snap threshold", () => {
    // left = 100, ref = 110 → |100 - 110| = 10 > 6
    const guides = computeAlignmentGuides(obj, { x: [110] });
    expect(guides).toHaveLength(0);
  });

  it("returns a y guide when a ref is within snap threshold of the top edge", () => {
    // top = 50, ref = 54 → |50 - 54| = 4 ≤ 6
    const guides = computeAlignmentGuides(obj, { y: [54] });
    expect(guides.some((g) => g.axis === "y" && g.canvasPx === 54)).toBe(true);
  });

  it("snaps to centre-x (cx = 150)", () => {
    // cx = 150, ref = 152 → |150 - 152| = 2 ≤ 6
    const guides = computeAlignmentGuides(obj, { x: [152] });
    expect(guides.some((g) => g.axis === "x")).toBe(true);
  });

  it("snaps to right edge (right = 200)", () => {
    // right = 200, ref = 196 → |200 - 196| = 4 ≤ 6
    const guides = computeAlignmentGuides(obj, { x: [196] });
    expect(guides.some((g) => g.axis === "x")).toBe(true);
  });

  it("can return multiple guides for both axes simultaneously", () => {
    const guides = computeAlignmentGuides(obj, { x: [100], y: [50] });
    const hasX = guides.some((g) => g.axis === "x");
    const hasY = guides.some((g) => g.axis === "y");
    expect(hasX).toBe(true);
    expect(hasY).toBe(true);
  });

  it("does not duplicate a guide axis when multiple candidates match the same ref", () => {
    // Only one guide per ref even if multiple edges are within threshold
    // left=100, cx=150, right=200; ref=100 matches left exactly
    const guides = computeAlignmentGuides(obj, { x: [100] });
    const xGuides = guides.filter((g) => g.axis === "x" && g.canvasPx === 100);
    expect(xGuides.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// makeGridOverlay — smoke test (no canvas rendering)
// ---------------------------------------------------------------------------
describe("makeGridOverlay", () => {
  it("returns an object with a draw function", () => {
    const overlay = makeGridOverlay({
      gridSize: 32,
      showGrid: true,
      showRuler: true,
      snapToGrid: true,
      showGuides: true,
    });
    expect(typeof overlay.draw).toBe("function");
  });
});

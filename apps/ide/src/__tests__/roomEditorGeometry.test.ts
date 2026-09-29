import { describe, it, expect } from "vitest";
import {
  nineSliceRects,
  hitResizeHandle,
  resizeBox,
  snapValue,
  boxFromCenter,
  centerOfBox,
  screenToWorld,
  worldToScreen,
  zoomAt,
  fitCamera,
  clampZoom,
  MAX_ZOOM,
  MIN_ZOOM,
  portLayout,
  portToOverlay,
  overlayToPort,
  hitPort,
  insidePortOverlay,
} from "../components/panels/roomEditorGeometry";

describe("nineSliceRects", () => {
  const g = { left: 10, right: 10, top: 8, bottom: 8 };
  it("keeps corners at source size and stretches centre", () => {
    const r = nineSliceRects(48, 48, g, 200, 100);
    expect(r).toHaveLength(9);
    expect(r[0]).toEqual({
      sx: 0,
      sy: 0,
      sw: 10,
      sh: 8,
      dx: 0,
      dy: 0,
      dw: 10,
      dh: 8,
    });
    expect(r[4]).toEqual({
      sx: 10,
      sy: 8,
      sw: 28,
      sh: 32,
      dx: 10,
      dy: 8,
      dw: 180,
      dh: 84,
    });
    expect(r[8]).toEqual({
      sx: 38,
      sy: 40,
      sw: 10,
      sh: 8,
      dx: 190,
      dy: 92,
      dw: 10,
      dh: 8,
    });
  });
  it("shrinks guides when destination is too small", () => {
    const r = nineSliceRects(48, 48, g, 10, 100);
    expect(r[0]?.dw).toBe(5);
    expect(r.every((x) => x.dx + x.dw <= 10)).toBe(true);
  });
  it("drops zero-size cells", () => {
    expect(
      nineSliceRects(32, 32, { left: 0, right: 0, top: 0, bottom: 0 }, 64, 64),
    ).toHaveLength(1);
  });
});

describe("hitResizeHandle", () => {
  const box = { x: 0, y: 0, w: 100, h: 60 };
  it("finds corners and edge midpoints", () => {
    expect(hitResizeHandle(1, 1, box, 6)).toBe("nw");
    expect(hitResizeHandle(100, 60, box, 6)).toBe("se");
    expect(hitResizeHandle(50, 0, box, 6)).toBe("n");
    expect(hitResizeHandle(100, 31, box, 6)).toBe("e");
  });
  it("returns null away from handles", () => {
    expect(hitResizeHandle(30, 30, box, 6)).toBeNull();
  });
});

describe("resizeBox / snap", () => {
  const box = { x: 100, y: 100, w: 64, h: 64 };
  it("moves only the dragged edge", () => {
    expect(resizeBox(box, "e", 200, 999, false, 32, 8)).toEqual({
      x: 100,
      y: 100,
      w: 100,
      h: 64,
    });
    expect(resizeBox(box, "nw", 80, 90, false, 32, 8)).toEqual({
      x: 80,
      y: 90,
      w: 84,
      h: 74,
    });
  });
  it("snaps the dragged edge to the grid", () => {
    expect(resizeBox(box, "se", 210, 190, true, 32, 8)).toEqual({
      x: 100,
      y: 100,
      w: 124,
      h: 92,
    });
    expect(snapValue(45, 32, true)).toBe(32);
    expect(snapValue(45, 32, false)).toBe(45);
  });
  it("clamps to min size instead of inverting", () => {
    expect(resizeBox(box, "e", 50, 0, false, 32, 8).w).toBe(8);
    expect(resizeBox(box, "n", 0, 500, false, 32, 8)).toMatchObject({
      y: 156,
      h: 8,
    });
  });
  it("centre/box conversion round-trips", () => {
    const b = boxFromCenter(100, 50, 40, 20);
    expect(b).toEqual({ x: 80, y: 40, w: 40, h: 20 });
    expect(centerOfBox(b)).toEqual({ x: 100, y: 50 });
  });
});

describe("pan / zoom camera", () => {
  it("screen and world conversions round-trip", () => {
    const cam = { x: 40, y: -20, zoom: 2 };
    const w = screenToWorld(cam, 140, 80);
    expect(w).toEqual({ x: 50, y: 50 });
    expect(worldToScreen(cam, w.x, w.y)).toEqual({ x: 140, y: 80 });
  });
  it("zoomAt keeps the world point under the cursor fixed and clamps", () => {
    const cam = { x: 10, y: 20, zoom: 1 };
    const before = screenToWorld(cam, 300, 200);
    const z = zoomAt(cam, 2, 300, 200);
    expect(z.zoom).toBe(2);
    expect(screenToWorld(z, 300, 200)).toEqual(before);
    expect(zoomAt(cam, 1e6, 0, 0).zoom).toBe(MAX_ZOOM);
    expect(zoomAt(cam, 1e-6, 0, 0).zoom).toBe(MIN_ZOOM);
    expect(clampZoom(3)).toBe(3);
  });
  it("fitCamera centres the bounds with margin", () => {
    const c = fitCamera({ x: 100, y: 100, w: 400, h: 200 }, 900, 500, 50);
    expect(c.zoom).toBe(2);
    const tl = worldToScreen(c, 100, 100);
    const br = worldToScreen(c, 500, 300);
    expect(tl).toEqual({ x: 50, y: 50 });
    expect(br).toEqual({ x: 850, y: 450 });
  });
});

describe("game-window port overlay", () => {
  const ports = [
    { x: 0, y: 0, w: 640, h: 384 },
    { x: 320, y: 192, w: 320, h: 192 },
  ];
  it("fits the window into the corner of the canvas", () => {
    const l = portLayout(ports, 960, 640);
    expect(l.winW).toBe(640);
    expect(l.winH).toBe(384);
    expect(l.scale).toBeCloseTo(0.375);
    expect(l.frame.x + l.frame.w).toBeCloseTo(950);
    expect(l.frame.y + l.frame.h).toBeCloseTo(630);
  });
  it("maps ports to the overlay and back", () => {
    const l = portLayout(ports, 960, 640);
    const b = portToOverlay(l, ports[1] as never);
    const back = overlayToPort(l, b.x, b.y);
    expect(back.x).toBeCloseTo(320);
    expect(back.y).toBeCloseTo(192);
  });
  it("hit-tests the topmost port and the overlay area", () => {
    const l = portLayout(ports, 960, 640);
    const inBoth = portToOverlay(l, { x: 400, y: 250, w: 1, h: 1 });
    expect(hitPort(l, ports, inBoth.x, inBoth.y)).toBe(1);
    const onlyFirst = portToOverlay(l, { x: 10, y: 10, w: 1, h: 1 });
    expect(hitPort(l, ports, onlyFirst.x, onlyFirst.y)).toBe(0);
    expect(hitPort(l, ports, 5, 5)).toBeNull();
    expect(insidePortOverlay(l, 5, 5)).toBe(false);
    expect(insidePortOverlay(l, l.frame.x + 1, l.frame.y + 1)).toBe(true);
  });
});

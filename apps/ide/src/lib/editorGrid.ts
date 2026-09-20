/**
 * Shared grid, ruler, and alignment-guide utilities used by all editor panels.
 *
 * Coordinate system: X increases right, Y increases downward (screen coords),
 * matching GMS2 and standard canvas 2D. When importing GMS2 assets the
 * coordinates are already compatible — no flip is needed.
 */

export interface GridOptions {
  gridSize: number;
  showGrid: boolean;
  showRuler: boolean;
  snapToGrid: boolean;
  showGuides: boolean;
  /** Scroll offset applied before drawing — ruler ticks stay world-aligned */
  scrollX?: number;
  scrollY?: number;
  /** Zoom factor (1 = 100%) */
  zoom?: number;
}

/**
 * Snap a value to the nearest grid cell boundary. Rounds the exact midpoint
 * between two cells away from zero (so -16 with a 32px grid snaps to -32,
 * mirroring how +16 snaps to +32) rather than using `Math.round`'s
 * round-half-up behaviour, which would pull negative midpoints toward zero
 * instead. Also normalizes a `-0` result (e.g. snapToGrid(-15, 32)) to `0`.
 */
export function snapToGrid(value: number, gridSize: number): number {
  const cells = value / gridSize;
  const roundedCells =
    cells >= 0 ? Math.floor(cells + 0.5) : Math.ceil(cells - 0.5);
  const snapped = roundedCells * gridSize;
  return Object.is(snapped, -0) ? 0 : snapped;
}

/** Snap a point to the nearest grid cell */
export function snapPoint(
  x: number,
  y: number,
  gridSize: number,
): { x: number; y: number } {
  return { x: snapToGrid(x, gridSize), y: snapToGrid(y, gridSize) };
}

const RULER_SIZE = 20; // px — thickness of ruler strip

export interface RulerMetrics {
  rulerSize: number;
}

export function getRulerMetrics(): RulerMetrics {
  return { rulerSize: RULER_SIZE };
}

/**
 * Draw grid lines onto a canvas context.
 * The caller is responsible for setting up ctx.save/restore around this.
 */
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  opts: GridOptions,
): void {
  if (!opts.showGrid) return;
  const gs = opts.gridSize;
  const sx = opts.scrollX ?? 0;
  const sy = opts.scrollY ?? 0;
  const zoom = opts.zoom ?? 1;
  const scaledGs = gs * zoom;

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;

  // vertical lines
  const startX = (((-sx * zoom) % scaledGs) + scaledGs) % scaledGs;
  for (let x = startX; x < canvasW; x += scaledGs) {
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, canvasH);
    ctx.stroke();
  }

  // horizontal lines
  const startY = (((-sy * zoom) % scaledGs) + scaledGs) % scaledGs;
  for (let y = startY; y < canvasH; y += scaledGs) {
    ctx.beginPath();
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(canvasW, Math.round(y) + 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Draw horizontal and vertical rulers with pixel/world-coordinate tick marks.
 * Rulers are RULER_SIZE px thick, placed along the top and left edges.
 */
export function drawRulers(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  opts: GridOptions,
): void {
  if (!opts.showRuler) return;
  const sx = opts.scrollX ?? 0;
  const sy = opts.scrollY ?? 0;
  const zoom = opts.zoom ?? 1;
  const R = RULER_SIZE;

  ctx.save();

  // Ruler background
  ctx.fillStyle = "var(--es-surface, #1e1e2e)";
  ctx.fillRect(0, 0, canvasW, R); // top ruler
  ctx.fillRect(0, 0, R, canvasH); // left ruler

  // Corner square
  ctx.fillStyle = "var(--es-border, #333)";
  ctx.fillRect(0, 0, R, R);

  ctx.strokeStyle = "var(--es-border, #333)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, R);
  ctx.lineTo(canvasW, R);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(R, 0);
  ctx.lineTo(R, canvasH);
  ctx.stroke();

  ctx.fillStyle = "var(--es-text-muted, #888)";
  ctx.font = "9px monospace";
  ctx.textBaseline = "top";

  // Choose tick interval so labels don't overlap
  const minPxBetweenTicks = 40;
  const worldPerPx = 1 / zoom;
  let interval = 1;
  const candidates = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000];
  for (const c of candidates) {
    if (c * zoom >= minPxBetweenTicks) {
      interval = c;
      break;
    }
  }

  // Horizontal ruler ticks (X axis, right = positive)
  const worldStartX = sx;
  const firstTickX = Math.ceil(worldStartX / interval) * interval;
  for (
    let world = firstTickX;
    world < worldStartX + canvasW * worldPerPx;
    world += interval
  ) {
    const px = R + (world - worldStartX) * zoom;
    if (px < R || px > canvasW) continue;
    const major = world % (interval * 5) === 0;
    const tickH = major ? 8 : 4;
    ctx.beginPath();
    ctx.moveTo(Math.round(px) + 0.5, R - tickH);
    ctx.lineTo(Math.round(px) + 0.5, R);
    ctx.strokeStyle = major
      ? "var(--es-text-muted, #aaa)"
      : "var(--es-border, #555)";
    ctx.stroke();
    if (major) {
      ctx.fillText(String(Math.round(world)), Math.round(px) + 2, 2);
    }
  }

  // Vertical ruler ticks (Y axis, down = positive — same as GMS2)
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  const worldStartY = sy;
  const firstTickY = Math.ceil(worldStartY / interval) * interval;
  for (
    let world = firstTickY;
    world < worldStartY + canvasH * worldPerPx;
    world += interval
  ) {
    const py = R + (world - worldStartY) * zoom;
    if (py < R || py > canvasH) continue;
    const major = world % (interval * 5) === 0;
    const tickW = major ? 8 : 4;
    ctx.beginPath();
    ctx.moveTo(R - tickW, Math.round(py) + 0.5);
    ctx.lineTo(R, Math.round(py) + 0.5);
    ctx.strokeStyle = major
      ? "var(--es-text-muted, #aaa)"
      : "var(--es-border, #555)";
    ctx.stroke();
    if (major) {
      ctx.save();
      ctx.translate(R - 2, Math.round(py));
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(String(Math.round(world)), 0, 0);
      ctx.restore();
    }
  }

  ctx.restore();
}

/** A single alignment guide line (horizontal or vertical) */
export interface GuideLineData {
  axis: "x" | "y";
  /** World-space position of the guide */
  position: number;
}

/**
 * Draw alignment guide lines onto the canvas.
 * Converts world positions to canvas pixels using scroll + zoom.
 */
export function drawGuides(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  guides: GuideLineData[],
  opts: Pick<
    GridOptions,
    "scrollX" | "scrollY" | "zoom" | "showGuides" | "showRuler"
  >,
): void {
  if (!opts.showGuides || guides.length === 0) return;
  const sx = opts.scrollX ?? 0;
  const sy = opts.scrollY ?? 0;
  const zoom = opts.zoom ?? 1;
  const R = opts.showRuler ? RULER_SIZE : 0;

  ctx.save();
  ctx.strokeStyle = "rgba(100,180,255,0.6)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);

  for (const g of guides) {
    if (g.axis === "x") {
      const px = R + (g.position - sx) * zoom;
      if (px < R || px > canvasW) continue;
      ctx.beginPath();
      ctx.moveTo(Math.round(px) + 0.5, R);
      ctx.lineTo(Math.round(px) + 0.5, canvasH);
      ctx.stroke();
    } else {
      const py = R + (g.position - sy) * zoom;
      if (py < R || py > canvasH) continue;
      ctx.beginPath();
      ctx.moveTo(R, Math.round(py) + 0.5);
      ctx.lineTo(canvasW, Math.round(py) + 0.5);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/**
 * Draw temporary drag-alignment snapping guides.
 * Pass the bounding box edges of the object being dragged and an array of
 * candidate reference positions (edges of other objects or grid lines).
 * Returns the adjusted (snapped) position.
 */
export interface AlignGuide {
  axis: "x" | "y";
  /** Canvas pixel position of the snapping guide */
  canvasPx: number;
}

const SNAP_THRESHOLD_PX = 6;

export function computeAlignmentGuides(
  /** Object being dragged — canvas pixel coords of its edges */
  obj: {
    left: number;
    right: number;
    top: number;
    bottom: number;
    cx: number;
    cy: number;
  },
  /** Reference edge positions in canvas pixels */
  refs: { x?: number[]; y?: number[] },
): AlignGuide[] {
  const guides: AlignGuide[] = [];

  const candidatesX = [obj.left, obj.cx, obj.right];
  const candidatesY = [obj.top, obj.cy, obj.bottom];

  for (const ref of refs.x ?? []) {
    for (const cand of candidatesX) {
      if (Math.abs(cand - ref) <= SNAP_THRESHOLD_PX) {
        guides.push({ axis: "x", canvasPx: ref });
        break;
      }
    }
  }
  for (const ref of refs.y ?? []) {
    for (const cand of candidatesY) {
      if (Math.abs(cand - ref) <= SNAP_THRESHOLD_PX) {
        guides.push({ axis: "y", canvasPx: ref });
        break;
      }
    }
  }
  return guides;
}

/**
 * A React hook-friendly helper: given a canvas element and grid options,
 * returns helper functions for drawing the overlay layer.
 */
export function makeGridOverlay(opts: GridOptions) {
  return {
    draw(
      ctx: CanvasRenderingContext2D,
      w: number,
      h: number,
      guides?: GuideLineData[],
    ): void {
      drawGrid(ctx, w, h, opts);
      if (guides) drawGuides(ctx, w, h, guides, opts);
      drawRulers(ctx, w, h, opts);
    },
  };
}

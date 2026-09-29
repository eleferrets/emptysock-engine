/** Pure geometry for the Room Editor's nine-slice/tiled instances: slice rects, resize handles, snapping. No DOM. */

export type SliceMode = 0 | 1 | 2;
export const SLICE_NONE: SliceMode = 0;
export const SLICE_NINE: SliceMode = 1;
export const SLICE_TILED: SliceMode = 2;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SliceGuides {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface DrawRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

/**
 * Nine source->destination rects (row-major) for a nine-slice draw of a
 * `srcW`x`srcH` texture into a `dstW`x`dstH` box at the origin. Corners keep
 * their source size; edges/centre stretch. If the destination is smaller than
 * the guides' sum on an axis, the guides shrink proportionally so corners
 * never overlap. Zero-size rects are dropped.
 */
export function nineSliceRects(
  srcW: number,
  srcH: number,
  g: SliceGuides,
  dstW: number,
  dstH: number,
): DrawRect[] {
  const fit = (a: number, b: number, total: number): [number, number] => {
    const sum = a + b;
    if (sum <= total || sum === 0) return [a, b];
    const k = total / sum;
    return [a * k, b * k];
  };
  const [sl, sr] = [
    Math.min(g.left, srcW),
    Math.min(g.right, Math.max(0, srcW - Math.min(g.left, srcW))),
  ];
  const [st, sb] = [
    Math.min(g.top, srcH),
    Math.min(g.bottom, Math.max(0, srcH - Math.min(g.top, srcH))),
  ];
  const [dl, dr] = fit(sl, sr, dstW);
  const [dt, db] = fit(st, sb, dstH);
  const sxs = [0, sl, srcW - sr, srcW];
  const sys = [0, st, srcH - sb, srcH];
  const dxs = [0, dl, dstW - dr, dstW];
  const dys = [0, dt, dstH - db, dstH];
  const out: DrawRect[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const sw = (sxs[c + 1] ?? 0) - (sxs[c] ?? 0);
      const sh = (sys[r + 1] ?? 0) - (sys[r] ?? 0);
      const dw = (dxs[c + 1] ?? 0) - (dxs[c] ?? 0);
      const dh = (dys[r + 1] ?? 0) - (dys[r] ?? 0);
      if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) continue;
      out.push({
        sx: sxs[c] ?? 0,
        sy: sys[r] ?? 0,
        sw,
        sh,
        dx: dxs[c] ?? 0,
        dy: dys[r] ?? 0,
        dw,
        dh,
      });
    }
  }
  return out;
}

export type HandleId = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

/** Handle under (px,py) for a box, within `tol` px of a corner/edge midpoint; corners win over edges. */
export function hitResizeHandle(
  px: number,
  py: number,
  box: Box,
  tol: number,
): HandleId | null {
  const l = box.x;
  const r = box.x + box.w;
  const t = box.y;
  const b = box.y + box.h;
  const mx = box.x + box.w / 2;
  const my = box.y + box.h / 2;
  const pts: [HandleId, number, number][] = [
    ["nw", l, t],
    ["ne", r, t],
    ["se", r, b],
    ["sw", l, b],
    ["n", mx, t],
    ["e", r, my],
    ["s", mx, b],
    ["w", l, my],
  ];
  for (const [id, hx, hy] of pts) {
    if (Math.abs(px - hx) <= tol && Math.abs(py - hy) <= tol) return id;
  }
  return null;
}

export function snapValue(v: number, grid: number, on: boolean): number {
  return on && grid > 0 ? Math.round(v / grid) * grid : v;
}

/**
 * New box after dragging `handle` to pointer (px,py). The opposite edge stays
 * fixed; the dragged edge snaps to the grid when `snap` is on; each axis is
 * clamped to `minSize` (never flips/inverts).
 */
export function resizeBox(
  box: Box,
  handle: HandleId,
  px: number,
  py: number,
  snap: boolean,
  grid: number,
  minSize: number,
): Box {
  let l = box.x;
  let r = box.x + box.w;
  let t = box.y;
  let b = box.y + box.h;
  const sx = snapValue(px, grid, snap);
  const sy = snapValue(py, grid, snap);
  if (handle.includes("w")) l = Math.min(sx, r - minSize);
  if (handle.includes("e")) r = Math.max(sx, l + minSize);
  if (handle.includes("n")) t = Math.min(sy, b - minSize);
  if (handle.includes("s")) b = Math.max(sy, t + minSize);
  return { x: l, y: t, w: r - l, h: b - t };
}

/** Box (top-left + size) for an instance whose x/y is its centre (Sprite anchor 0.5). */
export function boxFromCenter(x: number, y: number, w: number, h: number): Box {
  return { x: x - w / 2, y: y - h / 2, w, h };
}

export function centerOfBox(b: Box): { x: number; y: number } {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

// ── Pan / zoom camera ───────────────────────────────────────────────────────

/** Editor camera: a world point `w` is drawn at screen `w * zoom + (x, y)`. */
export interface Camera2D {
  x: number;
  y: number;
  zoom: number;
}

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8;
export const DEFAULT_CAMERA: Camera2D = { x: 0, y: 0, zoom: 1 };

export function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

export function screenToWorld(
  cam: Camera2D,
  sx: number,
  sy: number,
): { x: number; y: number } {
  return { x: (sx - cam.x) / cam.zoom, y: (sy - cam.y) / cam.zoom };
}

export function worldToScreen(
  cam: Camera2D,
  wx: number,
  wy: number,
): { x: number; y: number } {
  return { x: wx * cam.zoom + cam.x, y: wy * cam.zoom + cam.y };
}

/** Zooms by `factor` keeping the world point under screen (sx, sy) fixed. */
export function zoomAt(
  cam: Camera2D,
  factor: number,
  sx: number,
  sy: number,
): Camera2D {
  const zoom = clampZoom(cam.zoom * factor);
  const w = screenToWorld(cam, sx, sy);
  return { zoom, x: sx - w.x * zoom, y: sy - w.y * zoom };
}

/** Camera that fits `bounds` (world) inside a `viewW` x `viewH` screen with `margin`, centred. */
export function fitCamera(
  bounds: Box,
  viewW: number,
  viewH: number,
  margin = 24,
): Camera2D {
  const bw = Math.max(1, bounds.w);
  const bh = Math.max(1, bounds.h);
  const zoom = clampZoom(
    Math.min((viewW - margin * 2) / bw, (viewH - margin * 2) / bh),
  );
  return {
    zoom,
    x: (viewW - bw * zoom) / 2 - bounds.x * zoom,
    y: (viewH - bh * zoom) / 2 - bounds.y * zoom,
  };
}

// ── Game-window "port" overlay ──────────────────────────────────────────────

/**
 * A view's screen (port) rectangle lives in game-window space, not room
 * space, so it is edited in a small fixed overlay showing the whole window
 * with every view's port inside it.
 */
export interface PortLayout {
  scale: number;
  winW: number;
  winH: number;
  /** The window rectangle in canvas (screen) pixels. */
  frame: Box;
}

export const PORT_OVERLAY_MAX = { w: 240, h: 150 };
export const PORT_OVERLAY_MARGIN = 10;

export function portLayout(
  ports: readonly Box[],
  canvasW: number,
  canvasH: number,
): PortLayout {
  let winW = 320;
  let winH = 180;
  for (const p of ports) {
    winW = Math.max(winW, p.x + p.w);
    winH = Math.max(winH, p.y + p.h);
  }
  const scale = Math.min(PORT_OVERLAY_MAX.w / winW, PORT_OVERLAY_MAX.h / winH);
  const w = winW * scale;
  const h = winH * scale;
  return {
    scale,
    winW,
    winH,
    frame: {
      x: canvasW - PORT_OVERLAY_MARGIN - w,
      y: canvasH - PORT_OVERLAY_MARGIN - h,
      w,
      h,
    },
  };
}

export function portToOverlay(l: PortLayout, p: Box): Box {
  return {
    x: l.frame.x + p.x * l.scale,
    y: l.frame.y + p.y * l.scale,
    w: p.w * l.scale,
    h: p.h * l.scale,
  };
}

export function overlayToPort(
  l: PortLayout,
  sx: number,
  sy: number,
): { x: number; y: number } {
  return { x: (sx - l.frame.x) / l.scale, y: (sy - l.frame.y) / l.scale };
}

/** Whether a canvas point lies inside the overlay (including a small grab margin). */
export function insidePortOverlay(
  l: PortLayout,
  sx: number,
  sy: number,
  pad = 6,
): boolean {
  return (
    sx >= l.frame.x - pad &&
    sx <= l.frame.x + l.frame.w + pad &&
    sy >= l.frame.y - pad &&
    sy <= l.frame.y + l.frame.h + pad
  );
}

/** Topmost (last) port whose overlay rectangle contains the canvas point. */
export function hitPort(
  l: PortLayout,
  ports: readonly Box[],
  sx: number,
  sy: number,
): number | null {
  for (let i = ports.length - 1; i >= 0; i--) {
    const p = ports[i];
    if (p === undefined) continue;
    const b = portToOverlay(l, p);
    if (sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h) return i;
  }
  return null;
}

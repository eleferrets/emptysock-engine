// ── Layout constants ──────────────────────────────────────────────────────────

export const NODE_W = 220;
export const NODE_H = 100;
export const MIN_SCALE = 0.25;
export const MAX_SCALE = 2.5;
export const GUIDE_THRESHOLD = 6;
export const MINI_W = 160;
export const MINI_H = 100;

// ── Pure utilities ────────────────────────────────────────────────────────────

export function clampScale(s: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

export function snapValue(v: number, gridSize: number): number {
  return Math.round(v / gridSize) * gridSize;
}

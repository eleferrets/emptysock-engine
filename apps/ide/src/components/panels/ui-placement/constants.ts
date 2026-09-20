import type { WidgetAnchor } from "./layout";

// ── Constants ─────────────────────────────────────────────────────────────────

export const ANCHORS: WidgetAnchor[] = [
  "top-left",
  "top",
  "top-right",
  "left",
  "center",
  "right",
  "bottom-left",
  "bottom",
  "bottom-right",
];

export const ANCHOR_GRID_POS: Record<
  WidgetAnchor,
  { col: number; row: number }
> = {
  "top-left": { col: 0, row: 0 },
  top: { col: 1, row: 0 },
  "top-right": { col: 2, row: 0 },
  left: { col: 0, row: 1 },
  center: { col: 1, row: 1 },
  right: { col: 2, row: 1 },
  "bottom-left": { col: 0, row: 2 },
  bottom: { col: 1, row: 2 },
  "bottom-right": { col: 2, row: 2 },
};

export const CANVAS_W = 480;
export const CANVAS_H = 270;

export const QUIPS = [
  "No widgets yet — drag one from the palette.",
  "Blank canvas. Your UI awaits.",
  "Empty. Drag something in.",
  "Nothing placed. That's a choice.",
  "The palette is right there.",
  "Zero widgets. Zero regrets. Probably.",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

let _nextId = 1;
export function nextId(): string {
  return `w${_nextId++}`;
}

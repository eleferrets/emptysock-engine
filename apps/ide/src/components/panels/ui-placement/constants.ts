import type React from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type WidgetType =
  | "panel"
  | "button"
  | "label"
  | "progress-bar"
  | "slider"
  | "checkbox"
  | "image";

export type WidgetAnchor =
  | "top-left"
  | "top"
  | "top-right"
  | "left"
  | "center"
  | "right"
  | "bottom-left"
  | "bottom"
  | "bottom-right";

export interface PlacedWidget {
  id: string;
  type: WidgetType;
  anchor: WidgetAnchor;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const WIDGET_SIZE: Record<WidgetType, { w: number; h: number }> = {
  panel: { w: 200, h: 120 },
  button: { w: 120, h: 36 },
  label: { w: 80, h: 20 },
  "progress-bar": { w: 200, h: 20 },
  slider: { w: 160, h: 24 },
  checkbox: { w: 140, h: 22 },
  image: { w: 64, h: 64 },
};

export const WIDGET_LABEL: Record<WidgetType, string> = {
  panel: "PanelWidget",
  button: "ButtonWidget",
  label: "LabelWidget",
  "progress-bar": "ProgressBarWidget",
  slider: "SliderWidget",
  checkbox: "CheckboxWidget",
  image: "ImageWidget",
};

export const WIDGET_SNIPPET: Record<
  WidgetType,
  (anchor: WidgetAnchor, x: number, y: number) => string
> = {
  panel: (a, x, y) =>
    `const panel = new PanelWidget({ anchor: '${a}', x: ${x}, y: ${y}, width: 200, height: 120 });\nthis.uiSystem.add(panel);`,
  button: (a, x, y) =>
    `const btn = new ButtonWidget({ label: 'Button', anchor: '${a}', x: ${x}, y: ${y}, width: 120, height: 36 });\nbtn.on('click', () => { /* TODO */ });\nthis.uiSystem.add(btn);`,
  label: (a, x, y) =>
    `const lbl = new LabelWidget({ text: 'Label', anchor: '${a}', x: ${x}, y: ${y}, fontSize: 16 });\nthis.uiSystem.add(lbl);`,
  "progress-bar": (a, x, y) =>
    `const bar = new ProgressBarWidget({ anchor: '${a}', x: ${x}, y: ${y}, width: 200, height: 20, value: 0.75, min: 0, max: 1, fillColor: '#4ade80' });\nthis.uiSystem.add(bar);`,
  slider: (a, x, y) =>
    `const slider = new SliderWidget({ anchor: '${a}', x: ${x}, y: ${y}, width: 160, value: 0.5, min: 0, max: 1, onChange: (v) => { /* TODO */ } });\nthis.uiSystem.add(slider);`,
  checkbox: (a, x, y) =>
    `const chk = new CheckboxWidget({ label: 'Option', anchor: '${a}', x: ${x}, y: ${y}, checked: false, onChange: (v) => { /* TODO */ } });\nthis.uiSystem.add(chk);`,
  image: (a, x, y) =>
    `const img = new ImageWidget({ src: 'assets/image.png', anchor: '${a}', x: ${x}, y: ${y}, width: 64, height: 64 });\nthis.uiSystem.add(img);`,
};

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
  "No widgets yet — drag one from the palette.",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

let _nextId = 1;
export function nextId(): string {
  return `w${_nextId++}`;
}

export function getClientPos(
  e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
): { clientX: number; clientY: number } {
  if ("touches" in e) {
    const t = e.type === "touchend" ? e.changedTouches[0] : e.touches[0];
    return { clientX: t?.clientX ?? 0, clientY: t?.clientY ?? 0 };
  }
  return { clientX: e.clientX, clientY: e.clientY };
}

export function canvasEventToWorld(
  e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  canvas: HTMLCanvasElement,
  rulerSize: number,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const { clientX, clientY } = getClientPos(e);
  const px = (clientX - rect.left) * scaleX;
  const py = (clientY - rect.top) * scaleY;
  return { x: Math.round(px - rulerSize), y: Math.round(py - rulerSize) };
}

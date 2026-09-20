// Code/visual parity layer for the UI Widget Editor panel.
//
// `PlacedWidget.opts` is *exactly* the constructor-options object a developer
// would hand-write for the matching `@emptysock/engine` Widget subclass
// (`LabelWidgetOpts`, `ButtonWidgetOpts`, ...). Nothing here re-shapes that
// data — `layoutToWidgets` just calls `new XWidget(opts)` per entry, so the
// panel's save format and the hand-written code path produce identical
// `Widget` instances from identical data.
import {
  LabelWidget,
  ButtonWidget,
  PanelWidget,
  ProgressBarWidget,
  SliderWidget,
  CheckboxWidget,
  ImageWidget,
  type Widget,
  type WidgetAnchor,
  type LabelWidgetOpts,
  type ButtonWidgetOpts,
  type PanelWidgetOpts,
  type ProgressBarWidgetOpts,
  type SliderWidgetOpts,
  type CheckboxWidgetOpts,
  type ImageWidgetOpts,
} from "@emptysock/engine";

export type { WidgetAnchor };

export type WidgetType =
  | "panel"
  | "button"
  | "label"
  | "progress-bar"
  | "slider"
  | "checkbox"
  | "image";

/** Per-type constructor-options shape, keyed exactly like the engine exports. */
export interface WidgetOptsMap {
  panel: PanelWidgetOpts;
  button: ButtonWidgetOpts;
  label: LabelWidgetOpts;
  "progress-bar": ProgressBarWidgetOpts;
  slider: SliderWidgetOpts;
  checkbox: CheckboxWidgetOpts;
  image: ImageWidgetOpts;
}

/**
 * One placed widget. `opts` is the real constructor-options object (minus
 * `onChange`, which isn't serialisable — callbacks stay in hand-written
 * code and are re-attached the same way after `layoutToWidgets`).
 */
export interface PlacedWidget<T extends WidgetType = WidgetType> {
  id: string;
  type: T;
  opts: Omit<WidgetOptsMap[T], "onChange">;
}

export const WIDGET_LABEL: Record<WidgetType, string> = {
  panel: "PanelWidget",
  button: "ButtonWidget",
  label: "LabelWidget",
  "progress-bar": "ProgressBarWidget",
  slider: "SliderWidget",
  checkbox: "CheckboxWidget",
  image: "ImageWidget",
};

export const WIDGET_TYPES: WidgetType[] = [
  "panel",
  "button",
  "label",
  "progress-bar",
  "slider",
  "checkbox",
  "image",
];

/** Default constructor-options for a freshly-placed widget of each type. */
export function defaultOpts<T extends WidgetType>(
  type: T,
  anchor: WidgetAnchor,
  x: number,
  y: number,
): WidgetOptsMap[T] {
  const base = { anchor, x, y };
  let result: WidgetOptsMap[WidgetType];
  switch (type as WidgetType) {
    case "panel":
      result = {
        ...base,
        width: 200,
        height: 120,
        background: "#1a1a2e",
        cornerRadius: 6,
      } satisfies PanelWidgetOpts;
      break;
    case "button":
      result = {
        ...base,
        width: 120,
        height: 36,
        label: "Button",
      } satisfies ButtonWidgetOpts;
      break;
    case "label":
      result = {
        ...base,
        text: "Label",
        fontSize: 16,
      } satisfies LabelWidgetOpts;
      break;
    case "progress-bar":
      result = {
        ...base,
        width: 200,
        height: 20,
        value: 0.75,
        min: 0,
        max: 1,
        fillColor: "#4ade80",
      } satisfies ProgressBarWidgetOpts;
      break;
    case "slider":
      result = {
        ...base,
        width: 160,
        height: 20,
        value: 0.5,
        min: 0,
        max: 1,
      } satisfies SliderWidgetOpts;
      break;
    case "checkbox":
      result = {
        ...base,
        label: "Option",
        checked: false,
      } satisfies CheckboxWidgetOpts;
      break;
    case "image":
      result = {
        ...base,
        width: 64,
        height: 64,
        src: "assets/image.png",
      } satisfies ImageWidgetOpts;
      break;
  }
  return result as WidgetOptsMap[T];
}

/** Bounding box for placement/hit-testing/drawing, read off the real opts. */
export function widgetBounds(w: PlacedWidget): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const o = w.opts as {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
  const fallback = defaultOpts(w.type, "top-left", 0, 0) as {
    width?: number;
    height?: number;
  };
  return {
    x: o.x ?? 0,
    y: o.y ?? 0,
    w: o.width ?? fallback.width ?? 100,
    h: o.height ?? fallback.height ?? 40,
  };
}

export function widgetAnchor(w: PlacedWidget): WidgetAnchor {
  return (w.opts as { anchor?: WidgetAnchor }).anchor ?? "top-left";
}

/**
 * Lossless, one-call mapping from the panel's saved layout to real `Widget`
 * instances — the exact same construction a developer would write by hand:
 *
 * ```ts
 * const widgets = layoutToWidgets(layout);
 * for (const w of widgets) uiSystem.add(w);
 * ```
 */
export function layoutToWidgets(layout: PlacedWidget[]): Widget[] {
  return layout.map((w) => {
    switch (w.type) {
      case "panel":
        return new PanelWidget(w.opts as PanelWidgetOpts);
      case "button":
        return new ButtonWidget(w.opts as ButtonWidgetOpts);
      case "label":
        return new LabelWidget(w.opts as LabelWidgetOpts);
      case "progress-bar":
        return new ProgressBarWidget(w.opts as ProgressBarWidgetOpts);
      case "slider":
        return new SliderWidget(w.opts as SliderWidgetOpts);
      case "checkbox":
        return new CheckboxWidget(w.opts as CheckboxWidgetOpts);
      case "image":
        return new ImageWidget(w.opts as ImageWidgetOpts);
    }
  });
}

/** Renders an options object as a TS object literal (unquoted string keys). */
function optsToSource(opts: Record<string, unknown>): string {
  const entries = Object.entries(opts).filter(([, v]) => v !== undefined);
  const parts = entries.map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
  return `{ ${parts.join(", ")} }`;
}

const CTOR_NAME: Record<WidgetType, string> = {
  panel: "PanelWidget",
  button: "ButtonWidget",
  label: "LabelWidget",
  "progress-bar": "ProgressBarWidget",
  slider: "SliderWidget",
  checkbox: "CheckboxWidget",
  image: "ImageWidget",
};

const VAR_NAME: Record<WidgetType, string> = {
  panel: "panel",
  button: "btn",
  label: "lbl",
  "progress-bar": "bar",
  slider: "slider",
  checkbox: "chk",
  image: "img",
};

/**
 * Generates the exact hand-written-equivalent code for one placed widget,
 * built from the same `opts` object `layoutToWidgets` consumes — proving the
 * visual and code paths share one data shape rather than two parallel ones.
 */
export function widgetToSnippet(w: PlacedWidget): string {
  const ctor = CTOR_NAME[w.type];
  const varName = VAR_NAME[w.type];
  const optsSrc = optsToSource(w.opts as Record<string, unknown>);
  const lines = [`const ${varName} = new ${ctor}(${optsSrc});`];
  if (w.type === "button")
    lines.push(`${varName}.on('click', () => { /* TODO */ });`);
  if (w.type === "slider" || w.type === "checkbox") {
    lines.push(`${varName}.on('change', (v) => { /* TODO */ });`);
  }
  lines.push(`this.uiSystem.add(${varName});`);
  return lines.join("\n");
}

export function layoutToSnippet(layout: PlacedWidget[]): string {
  return layout
    .map((w) => `// ${WIDGET_LABEL[w.type]}\n${widgetToSnippet(w)}`)
    .join("\n\n");
}

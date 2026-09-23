// Code/visual parity layer for the UI Widget Editor panel.
//
// `PlacedWidget.opts` mirrors the exact field set the matching ECS widget-kind
// component (`Label`/`PanelStyle`/`ButtonState`/`Checkbox`/`Slider`/
// `Progress`/`ImageWidget`, `@emptysock/engine/ecs`) accepts, plus `width`/
// `height` (→ `LayoutStyle`) and `x`/`y`/`anchor` (→ `resolveAnchoredPosition`
// → `LayoutStyle.left`/`.top`). `layoutToEntities` spawns real widget entities
// via `WidgetTree.createWidget()` and `entity.add(Component, opts)` — the
// same construction a developer would write by hand — so the panel's save
// format and the hand-written code path produce identical live entities from
// identical data.
import {
  Label,
  PanelStyle,
  ButtonState,
  Checkbox,
  Slider,
  Progress,
  ImageWidget,
  LayoutStyle,
  resolveAnchoredPosition,
  type WidgetAnchor,
  type Entity,
  type Scene,
  type WidgetTree,
} from "@emptysock/engine/ecs";

export type { WidgetAnchor };

export type WidgetType =
  | "panel"
  | "button"
  | "label"
  | "progress-bar"
  | "slider"
  | "checkbox"
  | "image";

/** Per-type style-field shape, keyed exactly like the matching ECS component's own fields (plus shared `x`/`y`/`width`/`height`/`anchor`). */
export interface WidgetOptsMap {
  panel: ReturnType<typeof PanelStyle.createDefaults> & PlacementFields;
  button: ReturnType<typeof ButtonState.createDefaults> & PlacementFields;
  label: ReturnType<typeof Label.createDefaults> & PlacementFields;
  "progress-bar": ReturnType<typeof Progress.createDefaults> & PlacementFields;
  slider: ReturnType<typeof Slider.createDefaults> & PlacementFields;
  checkbox: ReturnType<typeof Checkbox.createDefaults> & PlacementFields;
  image: ReturnType<typeof ImageWidget.createDefaults> & PlacementFields;
}

interface PlacementFields {
  x: number;
  y: number;
  width: number;
  height: number;
  anchor: WidgetAnchor;
}

/** One placed widget — `opts` is the real flat data `layoutToEntities` consumes. */
export interface PlacedWidget<T extends WidgetType = WidgetType> {
  id: string;
  type: T;
  opts: WidgetOptsMap[T];
}

export const WIDGET_LABEL: Record<WidgetType, string> = {
  panel: "Panel",
  button: "Button",
  label: "Label",
  "progress-bar": "Progress",
  slider: "Slider",
  checkbox: "Checkbox",
  image: "Image",
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

/** Default field values for a freshly-placed widget of each type. */
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
        ...PanelStyle.createDefaults(),
        width: 200,
        height: 120,
      };
      break;
    case "button":
      result = {
        ...base,
        ...ButtonState.createDefaults(),
        width: 120,
        height: 36,
      };
      break;
    case "label":
      result = {
        ...base,
        ...Label.createDefaults(),
        width: 100,
        height: 24,
      };
      break;
    case "progress-bar":
      result = {
        ...base,
        ...Progress.createDefaults(),
        value: 0.75,
        width: 200,
        height: 20,
      };
      break;
    case "slider":
      result = {
        ...base,
        ...Slider.createDefaults(),
        value: 0.5,
        width: 160,
        height: 20,
      };
      break;
    case "checkbox":
      result = {
        ...base,
        ...Checkbox.createDefaults(),
        label: "Option",
        width: 24,
        height: 24,
      };
      break;
    case "image":
      result = {
        ...base,
        ...ImageWidget.createDefaults(),
        src: "assets/image.png",
        width: 64,
        height: 64,
      };
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
  const o = asRecord(w.opts);
  return { x: o.x, y: o.y, w: o.width, h: o.height };
}

export function widgetAnchor(w: PlacedWidget): WidgetAnchor {
  return asRecord(w.opts).anchor as WidgetAnchor;
}

/** Loosens a `WidgetOptsMap[T]` value to a plain record for generic field access — every real field access still goes through this one cast site. */
function asRecord(
  opts: WidgetOptsMap[WidgetType],
): Record<string, unknown> & PlacementFields {
  return opts as unknown as Record<string, unknown> & PlacementFields;
}

/** Style fields only — `opts` minus the shared placement fields `LayoutStyle` already owns. */
function styleFields(opts: WidgetOptsMap[WidgetType]): Record<string, unknown> {
  const {
    x: _x,
    y: _y,
    width: _w,
    height: _h,
    anchor: _a,
    ...style
  } = asRecord(opts);
  void _x;
  void _y;
  void _w;
  void _h;
  void _a;
  return style;
}

/**
 * Lossless, one-call mapping from the panel's saved layout to real, live
 * widget entities on `scene`/`tree` — the exact same construction a
 * developer would write by hand:
 *
 * ```ts
 * const entities = layoutToEntities(scene, tree, layout, canvasW, canvasH);
 * ```
 *
 * `canvasWidth`/`canvasHeight` resolve each widget's anchor into an absolute
 * `LayoutStyle.left`/`.top` (`positionType: 1` — outside the parent's flex
 * flow, per `LayoutStyle`'s own doc comment).
 */
export function layoutToEntities(
  scene: Scene,
  tree: WidgetTree,
  layout: PlacedWidget[],
  canvasWidth: number,
  canvasHeight: number,
): Entity[] {
  return layout.map((w) => {
    const entity = tree.createWidget(scene);
    const opts = asRecord(w.opts);
    const { left, top } = resolveAnchoredPosition(
      opts.anchor,
      opts.x,
      opts.y,
      opts.width,
      opts.height,
      canvasWidth,
      canvasHeight,
    );
    // `tree.createWidget()` already attaches a default `LayoutStyle` —
    // overwrite its fields in place rather than `.add()`-ing a second time.
    const layoutStyle = entity.get(LayoutStyle);
    if (layoutStyle !== undefined) {
      Object.assign(layoutStyle, {
        positionType: 1,
        left,
        top,
        width: opts.width,
        height: opts.height,
      });
    }
    const style = styleFields(w.opts);
    switch (w.type) {
      case "panel":
        entity.add(PanelStyle, style as never);
        break;
      case "button":
        entity.add(ButtonState, style as never);
        break;
      case "label":
        entity.add(Label, style as never);
        break;
      case "progress-bar":
        entity.add(Progress, style as never);
        break;
      case "slider":
        entity.add(Slider, style as never);
        break;
      case "checkbox":
        entity.add(Checkbox, style as never);
        break;
      case "image":
        entity.add(ImageWidget, style as never);
        break;
    }
    return entity;
  });
}

/** Renders an options object as a TS object literal (unquoted string keys). */
function optsToSource(opts: Record<string, unknown>): string {
  const entries = Object.entries(opts).filter(([, v]) => v !== undefined);
  const parts = entries.map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
  return `{ ${parts.join(", ")} }`;
}

const COMPONENT_NAME: Record<WidgetType, string> = {
  panel: "PanelStyle",
  button: "ButtonState",
  label: "Label",
  "progress-bar": "Progress",
  slider: "Slider",
  checkbox: "Checkbox",
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
 * Generates the exact hand-written-equivalent ECS code for one placed
 * widget, built from the same `opts` object `layoutToEntities` consumes —
 * proving the visual and code paths share one data shape rather than two
 * parallel ones.
 */
export function widgetToSnippet(w: PlacedWidget): string {
  const componentName = COMPONENT_NAME[w.type];
  const varName = VAR_NAME[w.type];
  const opts = asRecord(w.opts);
  const { width, height } = opts;
  const style = styleFields(w.opts);
  const styleSrc = optsToSource(style);
  const lines = [
    `const ${varName} = tree.createWidget(scene);`,
    `${varName}.add(LayoutStyle, { positionType: 1, left: 0, top: 0, width: ${String(
      width,
    )}, height: ${String(height)} }); // resolve x/y/anchor via resolveAnchoredPosition()`,
    `${varName}.add(${componentName}, ${styleSrc});`,
  ];
  return lines.join("\n");
}

export function layoutToSnippet(layout: PlacedWidget[]): string {
  return layout
    .map((w) => `// ${WIDGET_LABEL[w.type]}\n${widgetToSnippet(w)}`)
    .join("\n\n");
}

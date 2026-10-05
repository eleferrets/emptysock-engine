import { defineComponent } from "../Component.js";

/**
 * ECS-native widget-kind components, built on top
 * of `LayoutStyle`/`Layout` (see `Layout.ts`) the same way `Transform`+
 * `Sprite` composes for a render entity — a widget entity carries
 * `LayoutStyle`+`Layout` for its box, plus exactly one of the kind
 * components below for what it actually draws/does. Deliberately a small
 * surface: no per-widget animation (fadeIn/slideIn/pop/shake), no anchor
 * resolution, and no event-emitter callbacks (`.on("click", cb)`) — those
 * are real, separately-tracked gaps, not
 * oversights. `ImageWidget.src` real bitmap loading/caching is done —
 * `ui/UISystem.ts`'s `_renderImage()` loads it through the same pixi
 * `Assets.load` pattern `RenderPipeline` uses, cached by path. State instead lives directly
 * on these components and is read by polling each frame (`checkbox.checked`,
 * `slider.value`, `button.state`), the same "state lives in the component,
 * game code reads it" style `VisualScriptState`/`PhysicsBody` already
 * use elsewhere, rather than a callback-based event system.
 */

/** Optional on any widget entity; absent means visible, alpha 1 (the common case) so most widgets never need this component at all. */
export const WidgetAppearance = defineComponent(
  "WidgetAppearance",
  () => ({
    visible: true as boolean,
    alpha: 1,
  }),
  {
    schema: {
      visible: { kind: "boolean" },
      alpha: { kind: "number" },
    },
  },
);
export type WidgetAppearanceShape = ReturnType<
  typeof WidgetAppearance.createDefaults
>;

export const Label = defineComponent(
  "Label",
  () => ({
    text: "",
    color: "#ffffff",
    fontSize: 14,
    font: "sans-serif",
    /**
     * A `FontRegistry` id (see `systems/FontRegistry.ts`) — when set and
     * resolvable, `UISystem` renders with that registered font's family/
     * size/style instead of this component's own `font`/`fontSize` fields.
     * `""` (the default) means "no override, use `font`/`fontSize`
     * directly" — the same empty-string sentinel `Sprite.texturePath` uses
     * for "no texture set".
     */
    fontId: "",
    /** 0 = left, 1 = center, 2 = right. */
    align: 0,
  }),
  {
    schema: {
      text: { kind: "string" },
      color: { kind: "string" },
      fontSize: { kind: "number" },
      font: { kind: "string" },
      fontId: { kind: "string" },
      align: { kind: "enum", options: ["left", "center", "right"] },
    },
  },
);
export type LabelShape = ReturnType<typeof Label.createDefaults>;

export const PanelStyle = defineComponent(
  "PanelStyle",
  () => ({
    background: "#1a1a2e",
    borderColor: "#00000000",
    borderWidth: 0,
    borderRadius: 0,
  }),
  {
    schema: {
      background: { kind: "string" },
      borderColor: { kind: "string" },
      borderWidth: { kind: "number" },
      borderRadius: { kind: "number" },
    },
  },
);
export type PanelStyleShape = ReturnType<typeof PanelStyle.createDefaults>;

/**
 * `state` (0 normal / 1 hover / 2 pressed) is written by `UISystem`'s
 * pointer dispatch each frame, not by game code — treat it as a read-only
 * output for rendering, the same "engine writes, game code reads" contract
 * `Layout`'s x/y/width/height already has.
 */
export const ButtonState = defineComponent(
  "ButtonState",
  () => ({
    label: "Button",
    color: "#ffffff",
    background: "#3a3a5c",
    hoverBackground: "#4a4a7c",
    pressedBackground: "#2a2a4c",
    borderRadius: 4,
    fontSize: 14,
    font: "sans-serif",
    /** See `Label.fontId`'s doc comment — same `FontRegistry` id override. */
    fontId: "",
    disabled: false as boolean,
    state: 0,
  }),
  {
    schema: {
      label: { kind: "string" },
      color: { kind: "string" },
      background: { kind: "string" },
      hoverBackground: { kind: "string" },
      pressedBackground: { kind: "string" },
      borderRadius: { kind: "number" },
      fontSize: { kind: "number" },
      font: { kind: "string" },
      fontId: { kind: "string" },
      disabled: { kind: "boolean" },
    },
  },
);
export type ButtonStateShape = ReturnType<typeof ButtonState.createDefaults>;

export const Checkbox = defineComponent(
  "Checkbox",
  () => ({
    checked: false as boolean,
    label: "",
    color: "#ffffff",
    background: "#1a1a2e",
    borderColor: "#818cf8",
    fontSize: 14,
    font: "sans-serif",
    /** See `Label.fontId`'s doc comment — same `FontRegistry` id override. */
    fontId: "",
  }),
  {
    schema: {
      checked: { kind: "boolean" },
      label: { kind: "string" },
      color: { kind: "string" },
      background: { kind: "string" },
      borderColor: { kind: "string" },
      fontSize: { kind: "number" },
      font: { kind: "string" },
      fontId: { kind: "string" },
    },
  },
);
export type CheckboxShape = ReturnType<typeof Checkbox.createDefaults>;

export const Slider = defineComponent(
  "Slider",
  () => ({
    value: 0,
    min: 0,
    max: 1,
    step: 0,
    trackColor: "#555555",
    thumbColor: "#818cf8",
  }),
  {
    schema: {
      value: { kind: "number" },
      min: { kind: "number" },
      max: { kind: "number" },
      step: { kind: "number" },
      trackColor: { kind: "string" },
      thumbColor: { kind: "string" },
    },
  },
);
export type SliderShape = ReturnType<typeof Slider.createDefaults>;

export const Progress = defineComponent(
  "Progress",
  () => ({
    value: 0,
    min: 0,
    max: 1,
    trackColor: "#333333",
    fillColor: "#818cf8",
  }),
  {
    schema: {
      value: { kind: "number" },
      min: { kind: "number" },
      max: { kind: "number" },
      trackColor: { kind: "string" },
      fillColor: { kind: "string" },
    },
  },
);
export type ProgressShape = ReturnType<typeof Progress.createDefaults>;

/** Image loading/caching is a real, separately-tracked gap — this component only records the source path a future render pass would resolve. */
export const ImageWidget = defineComponent(
  "ImageWidget",
  () => ({
    src: "",
  }),
  {
    schema: {
      src: { kind: "string" },
    },
  },
);
export type ImageWidgetShape = ReturnType<typeof ImageWidget.createDefaults>;

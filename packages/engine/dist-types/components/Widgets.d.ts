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
export declare const WidgetAppearance: import("../Component.js").ComponentDef<{
  visible: boolean;
  alpha: number;
}>;
export type WidgetAppearanceShape = ReturnType<
  typeof WidgetAppearance.createDefaults
>;
export declare const Label: import("../Component.js").ComponentDef<{
  text: string;
  color: string;
  fontSize: number;
  font: string;
  /**
   * A `FontRegistry` id (see `systems/FontRegistry.ts`) — when set and
   * resolvable, `UISystem` renders with that registered font's family/
   * size/style instead of this component's own `font`/`fontSize` fields.
   * `""` (the default) means "no override, use `font`/`fontSize`
   * directly" — the same empty-string sentinel `Sprite.texturePath` uses
   * for "no texture set".
   */
  fontId: string;
  /** 0 = left, 1 = center, 2 = right. */
  align: number;
}>;
export type LabelShape = ReturnType<typeof Label.createDefaults>;
export declare const PanelStyle: import("../Component.js").ComponentDef<{
  background: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
}>;
export type PanelStyleShape = ReturnType<typeof PanelStyle.createDefaults>;
/**
 * `state` (0 normal / 1 hover / 2 pressed) is written by `UISystem`'s
 * pointer dispatch each frame, not by game code — treat it as a read-only
 * output for rendering, the same "engine writes, game code reads" contract
 * `Layout`'s x/y/width/height already has.
 */
export declare const ButtonState: import("../Component.js").ComponentDef<{
  label: string;
  color: string;
  background: string;
  hoverBackground: string;
  pressedBackground: string;
  borderRadius: number;
  fontSize: number;
  font: string;
  /** See `Label.fontId`'s doc comment — same `FontRegistry` id override. */
  fontId: string;
  disabled: boolean;
  state: number;
}>;
export type ButtonStateShape = ReturnType<typeof ButtonState.createDefaults>;
export declare const Checkbox: import("../Component.js").ComponentDef<{
  checked: boolean;
  label: string;
  color: string;
  background: string;
  borderColor: string;
  fontSize: number;
  font: string;
  /** See `Label.fontId`'s doc comment — same `FontRegistry` id override. */
  fontId: string;
}>;
export type CheckboxShape = ReturnType<typeof Checkbox.createDefaults>;
export declare const Slider: import("../Component.js").ComponentDef<{
  value: number;
  min: number;
  max: number;
  step: number;
  trackColor: string;
  thumbColor: string;
}>;
export type SliderShape = ReturnType<typeof Slider.createDefaults>;
export declare const Progress: import("../Component.js").ComponentDef<{
  value: number;
  min: number;
  max: number;
  trackColor: string;
  fillColor: string;
}>;
export type ProgressShape = ReturnType<typeof Progress.createDefaults>;
/** Image loading/caching is a real, separately-tracked gap — this component only records the source path a future render pass would resolve. */
export declare const ImageWidget: import("../Component.js").ComponentDef<{
  src: string;
}>;
export type ImageWidgetShape = ReturnType<typeof ImageWidget.createDefaults>;

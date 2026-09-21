import type { IUIRenderer } from "@emptysock/types";
export type { EasingName } from "../../core/easing.js";
/**
 * Minimum recommended interactive-widget dimension (in design-resolution
 * pixels), per the iOS Human Interface Guidelines' 44pt touch-target
 * recommendation. Button-like widgets warn (dev-mode console warning, never
 * a thrown error) when configured below this.
 */
export declare const MIN_INTERACTIVE_SIZE = 44;
/**
 * Warn (once per widget instance) if a button-like widget's configured size
 * falls below `MIN_INTERACTIVE_SIZE`. Never throws — this is UX guidance,
 * not a hard constraint, since some UIs intentionally use small controls.
 * No-op outside dev builds with a console available (guards the engine
 * environment boundary — this file must still run under Node/Vitest).
 */
export declare function warnIfBelowMinTouchTarget(
  label: string,
  width: number,
  height: number,
): void;
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
export type AnimationName =
  | "fadeIn"
  | "fadeOut"
  | "slideIn"
  | "slideOut"
  | "pop"
  | "shake";
export type SlideDirection = "left" | "right" | "up" | "down";
export type WidgetEvent = "click" | "hover" | "hoverOut" | "change" | "animEnd";
import type { EasingName } from "../../core/easing.js";
export interface AnimationOpts {
  duration?: number;
  easing?: EasingName;
  direction?: SlideDirection;
}
interface ActiveAnim {
  name: AnimationName;
  elapsed: number;
  duration: number;
  easing: EasingName;
  direction: SlideDirection;
}
export declare function applyEasing(t: number, easing?: EasingName): number;
export declare function widgetRoundRect(
  ctx: IUIRenderer,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void;
export interface BaseWidgetOpts {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  anchor?: WidgetAnchor;
  visible?: boolean;
  alpha?: number;
}
export declare abstract class Widget {
  readonly id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  anchor: WidgetAnchor;
  visible: boolean;
  alpha: number;
  readonly children: Widget[];
  _anim: ActiveAnim | null;
  _animDx: number;
  _animDy: number;
  _scaleX: number;
  _scaleY: number;
  _hovered: boolean;
  /**
   * Uniform display scale applied on top of `width`/`height`/`x`/`y` when
   * resolving screen-space position and hit-testing, intended to be driven
   * by the canvas-to-design-resolution ratio (e.g. from a future
   * ViewportSystem, or `UISystem.setScale`). Defaults to 1 — unscaled.
   */
  uiScale: number;
  private readonly _handlers;
  constructor(opts?: BaseWidgetOpts);
  on(event: WidgetEvent, handler: (value?: unknown) => void): () => void;
  off(event: WidgetEvent, handler: (value?: unknown) => void): void;
  _emit(event: WidgetEvent, value?: unknown): void;
  /**
   * Start an animation. `opts.duration` is in milliseconds (matching the
   * rest of the widget event API); `_tick(dt)` receives `dt` in seconds
   * (matching the engine's frame loop), so the duration is converted to
   * seconds once here rather than at every tick.
   */
  animate(name: AnimationName, opts?: AnimationOpts): void;
  _tick(dt: number): void;
  resolvedPosition(
    cw: number,
    ch: number,
  ): {
    x: number;
    y: number;
  };
  _scaledBounds(
    cw: number,
    ch: number,
  ): {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  contains(px: number, py: number, cw: number, ch: number): boolean;
  triggerClick(): void;
  _setHovered(hovered: boolean): void;
  abstract render(ctx: IUIRenderer, cw: number, ch: number): void;
}

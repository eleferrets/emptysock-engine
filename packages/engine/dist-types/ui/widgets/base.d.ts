import type { IUIRenderer } from "@emptysock/types";
export type { EasingName } from "../../core/easing.js";
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
  private readonly _handlers;
  constructor(opts?: BaseWidgetOpts);
  on(event: WidgetEvent, handler: (value?: unknown) => void): () => void;
  off(event: WidgetEvent, handler: (value?: unknown) => void): void;
  _emit(event: WidgetEvent, value?: unknown): void;
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

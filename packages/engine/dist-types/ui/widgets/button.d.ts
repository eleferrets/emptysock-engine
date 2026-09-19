import type { IUIRenderer } from "@emptysock/types";
import { Widget } from "./base.js";
import type { BaseWidgetOpts } from "./base.js";
export type ButtonState = "normal" | "hover" | "pressed" | "disabled";
export interface ButtonWidgetOpts extends BaseWidgetOpts {
  label?: string;
  icon?: string;
  color?: string;
  background?: string;
  hoverBackground?: string;
  pressedBackground?: string;
  borderRadius?: number;
  fontSize?: number;
  font?: string;
  disabled?: boolean;
  animateOnHover?: boolean;
}
export declare class ButtonWidget extends Widget {
  label: string;
  icon: string | undefined;
  color: string;
  background: string;
  hoverBackground: string;
  pressedBackground: string;
  borderRadius: number;
  fontSize: number;
  font: string;
  disabled: boolean;
  animateOnHover: boolean;
  private _btnState;
  constructor(opts?: ButtonWidgetOpts);
  get state(): ButtonState;
  _setHovered(hovered: boolean): void;
  triggerClick(): void;
  render(ctx: IUIRenderer, cw: number, ch: number): void;
}

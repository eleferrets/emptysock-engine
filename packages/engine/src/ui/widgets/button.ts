import type { IUIRenderer } from "@emptysock/types";
import { Widget, widgetRoundRect } from "./base.js";
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

export class ButtonWidget extends Widget {
  public label: string;
  public icon: string | undefined;
  public color: string;
  public background: string;
  public hoverBackground: string;
  public pressedBackground: string;
  public borderRadius: number;
  public fontSize: number;
  public font: string;
  public disabled: boolean;
  public animateOnHover: boolean;

  private _btnState: ButtonState = "normal";

  constructor(opts: ButtonWidgetOpts = {}) {
    super({ width: opts.width ?? 120, height: opts.height ?? 36, ...opts });
    this.label = opts.label ?? "Button";
    this.icon = opts.icon;
    this.color = opts.color ?? "#ffffff";
    this.background = opts.background ?? "#3a3a5c";
    this.hoverBackground = opts.hoverBackground ?? "#4a4a7c";
    this.pressedBackground = opts.pressedBackground ?? "#2a2a4c";
    this.borderRadius = opts.borderRadius ?? 4;
    this.fontSize = opts.fontSize ?? 14;
    this.font = opts.font ?? "sans-serif";
    this.disabled = opts.disabled ?? false;
    this.animateOnHover = opts.animateOnHover ?? true;
  }

  get state(): ButtonState {
    return this._btnState;
  }

  override _setHovered(hovered: boolean): void {
    if (this._hovered === hovered) return;
    this._hovered = hovered;
    if (this.disabled) return;
    this._btnState = hovered ? "hover" : "normal";
    this._emit(hovered ? "hover" : "hoverOut");
    if (hovered && this.animateOnHover) this.animate("pop", { duration: 0.12 });
  }

  override triggerClick(): void {
    if (this.disabled || !this.visible) return;
    this._emit("click");
  }

  render(ctx: IUIRenderer, cw: number, ch: number): void {
    if (!this.visible) return;
    const { x, y, w, h } = this._scaledBounds(cw, ch);
    ctx.save();
    ctx.globalAlpha = this.alpha * (this.disabled ? 0.5 : 1);

    const bg =
      this._btnState === "hover"
        ? this.hoverBackground
        : this._btnState === "pressed"
          ? this.pressedBackground
          : this.background;

    ctx.fillStyle = bg;
    ctx.beginPath();
    widgetRoundRect(ctx, x, y, w, h, this.borderRadius);
    ctx.fill();

    ctx.fillStyle = this.color;
    ctx.font = `${this.fontSize}px ${this.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.label, x + w / 2, y + h / 2);

    ctx.restore();
    for (const child of this.children) child.render(ctx, cw, ch);
  }
}

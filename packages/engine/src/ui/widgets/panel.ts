import type { IUIRenderer } from "@emptysock/types";
import { Widget, widgetRoundRect } from "./base.js";
import type { BaseWidgetOpts } from "./base.js";

export interface PanelWidgetOpts extends BaseWidgetOpts {
  background?: string;
  border?: string;
  borderWidth?: number;
  cornerRadius?: number;
}

export class PanelWidget extends Widget {
  public background: string;
  public border: string | undefined;
  public borderWidth: number;
  public cornerRadius: number;

  constructor(opts: PanelWidgetOpts = {}) {
    super({ width: opts.width ?? 200, height: opts.height ?? 150, ...opts });
    this.background = opts.background ?? "#1a1a2e";
    this.border = opts.border;
    this.borderWidth = opts.borderWidth ?? 1;
    this.cornerRadius = opts.cornerRadius ?? 6;
  }

  render(ctx: IUIRenderer, cw: number, ch: number): void {
    if (!this.visible) return;
    const { x, y, w, h } = this._scaledBounds(cw, ch);
    ctx.save();
    ctx.globalAlpha = this.alpha;

    ctx.fillStyle = this.background;
    ctx.beginPath();
    widgetRoundRect(ctx, x, y, w, h, this.cornerRadius);
    ctx.fill();

    if (this.border !== undefined) {
      ctx.strokeStyle = this.border;
      ctx.lineWidth = this.borderWidth;
      ctx.beginPath();
      widgetRoundRect(ctx, x, y, w, h, this.cornerRadius);
      ctx.stroke();
    }

    ctx.restore();
    for (const child of this.children) child.render(ctx, cw, ch);
  }
}

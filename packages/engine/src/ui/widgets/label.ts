import type { IUIRenderer } from "@emptysock/types";
import { Widget } from "./base.js";
import type { BaseWidgetOpts } from "./base.js";

export interface LabelWidgetOpts extends BaseWidgetOpts {
  text?: string;
  font?: string;
  fontSize?: number;
  color?: string;
  align?: "left" | "center" | "right";
}

export class LabelWidget extends Widget {
  public text: string;
  public font: string;
  public fontSize: number;
  public color: string;
  public align: "left" | "center" | "right";

  constructor(opts: LabelWidgetOpts = {}) {
    super({
      width: opts.width ?? 200,
      height: opts.height ?? (opts.fontSize ?? 14) * 1.5,
      ...opts,
    });
    this.text = opts.text ?? "";
    this.font = opts.font ?? "sans-serif";
    this.fontSize = opts.fontSize ?? 14;
    this.color = opts.color ?? "#ffffff";
    this.align = opts.align ?? "left";
  }

  render(ctx: IUIRenderer, cw: number, ch: number): void {
    if (!this.visible) return;
    const { x, y, w, h } = this._scaledBounds(cw, ch);
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.font = `${this.fontSize}px ${this.font}`;
    ctx.textAlign = this.align;
    ctx.textBaseline = "middle";
    const tx =
      this.align === "right" ? x + w : this.align === "center" ? x + w / 2 : x;
    ctx.fillText(this.text, tx, y + h / 2);
    ctx.restore();
    for (const child of this.children) child.render(ctx, cw, ch);
  }
}

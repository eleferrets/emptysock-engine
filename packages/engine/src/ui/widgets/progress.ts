import type { IUIRenderer } from "@emptysock/types";
import { Widget } from "./base.js";
import type { BaseWidgetOpts } from "./base.js";

export interface ProgressBarWidgetOpts extends BaseWidgetOpts {
  value?: number;
  min?: number;
  max?: number;
  fillColor?: string;
  trackColor?: string;
  direction?: "h" | "v";
}

export class ProgressBarWidget extends Widget {
  public value: number;
  public min: number;
  public max: number;
  public fillColor: string;
  public trackColor: string;
  public direction: "h" | "v";

  constructor(opts: ProgressBarWidgetOpts = {}) {
    super({ width: opts.width ?? 200, height: opts.height ?? 12, ...opts });
    this.value = opts.value ?? 0;
    this.min = opts.min ?? 0;
    this.max = opts.max ?? 1;
    this.fillColor = opts.fillColor ?? "#4caf50";
    this.trackColor = opts.trackColor ?? "#333333";
    this.direction = opts.direction ?? "h";
  }

  get normalised(): number {
    return Math.min(
      1,
      Math.max(0, (this.value - this.min) / (this.max - this.min)),
    );
  }

  render(ctx: IUIRenderer, cw: number, ch: number): void {
    if (!this.visible) return;
    const { x, y, w, h } = this._scaledBounds(cw, ch);
    const n = this.normalised;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.trackColor;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = this.fillColor;
    if (this.direction === "h") {
      ctx.fillRect(x, y, w * n, h);
    } else {
      ctx.fillRect(x, y + h * (1 - n), w, h * n);
    }
    ctx.restore();
    for (const child of this.children) child.render(ctx, cw, ch);
  }
}

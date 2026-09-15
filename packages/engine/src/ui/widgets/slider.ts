import type { IUIRenderer } from "@emptysock/types";
import { Widget } from "./base.js";
import type { BaseWidgetOpts } from "./base.js";

export interface SliderWidgetOpts extends BaseWidgetOpts {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  trackColor?: string;
  thumbColor?: string;
  onChange?: (value: number) => void;
}

export class SliderWidget extends Widget {
  public value: number;
  public min: number;
  public max: number;
  public step: number;
  public trackColor: string;
  public thumbColor: string;

  constructor(opts: SliderWidgetOpts = {}) {
    super({ width: opts.width ?? 200, height: opts.height ?? 20, ...opts });
    this.value = opts.value ?? 0;
    this.min = opts.min ?? 0;
    this.max = opts.max ?? 1;
    this.step = opts.step ?? 0;
    this.trackColor = opts.trackColor ?? "#555555";
    this.thumbColor = opts.thumbColor ?? "#818cf8";
    if (opts.onChange !== undefined) {
      const cb = opts.onChange;
      this.on("change", (v) => cb(v as number));
    }
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
    const trackH = Math.max(4, h * 0.25);
    const trackY = y + (h - trackH) / 2;
    ctx.fillStyle = this.trackColor;
    ctx.fillRect(x, trackY, w, trackH);
    const thumbR = h * 0.4;
    ctx.fillStyle = this.thumbColor;
    ctx.beginPath();
    ctx.arc(x + w * n, y + h / 2, thumbR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    for (const child of this.children) child.render(ctx, cw, ch);
  }
}

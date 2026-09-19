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
    // Wire click/pointer to update value from the pointer's x position.
    this.on("click", () => {
      // Pointer position is stored in _lastPointerX when UISystem dispatches.
      this._applyPointerX(this._lastPointerX);
    });
  }

  /** @internal set by UISystem before firing click/hover so slider can read it. */
  _lastPointerX: number = 0;
  /** @internal */
  _lastPointerCW: number = 1;

  /** Compute and apply a value from an absolute pointer x coordinate. */
  _applyPointerX(px: number): void {
    const rx = px - this._resolvedX;
    const w = this.width;
    if (w <= 0) return;
    let n = Math.max(0, Math.min(1, rx / w));
    let v = this.min + n * (this.max - this.min);
    if (this.step > 0) v = Math.round(v / this.step) * this.step;
    v = Math.max(this.min, Math.min(this.max, v));
    if (v !== this.value) {
      this.value = v;
      this._emit("change", v);
    }
  }

  /** @internal resolved x after anchor, set during render. */
  _resolvedX: number = 0;

  get normalised(): number {
    return Math.min(
      1,
      Math.max(0, (this.value - this.min) / (this.max - this.min)),
    );
  }

  render(ctx: IUIRenderer, cw: number, ch: number): void {
    if (!this.visible) return;
    const { x, y, w, h } = this._scaledBounds(cw, ch);
    this._resolvedX = x;
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

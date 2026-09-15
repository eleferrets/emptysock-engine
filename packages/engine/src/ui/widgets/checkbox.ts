import type { IUIRenderer } from "@emptysock/types";
import { Widget } from "./base.js";
import type { BaseWidgetOpts } from "./base.js";

export interface CheckboxWidgetOpts extends BaseWidgetOpts {
  checked?: boolean;
  label?: string;
  color?: string;
  background?: string;
  borderColor?: string;
  fontSize?: number;
  font?: string;
  onChange?: (checked: boolean) => void;
}

export class CheckboxWidget extends Widget {
  public checked: boolean;
  public label: string;
  public color: string;
  public background: string;
  public borderColor: string;
  public fontSize: number;
  public font: string;

  constructor(opts: CheckboxWidgetOpts = {}) {
    const boxSize = opts.height ?? 20;
    const labelText = opts.label ?? "";
    super({
      width:
        opts.width ??
        (labelText.length > 0
          ? boxSize + 8 + labelText.length * (opts.fontSize ?? 14) * 0.6
          : boxSize),
      height: boxSize,
      ...opts,
    });
    this.checked = opts.checked ?? false;
    this.label = labelText;
    this.color = opts.color ?? "#ffffff";
    this.background = opts.background ?? "#1a1a2e";
    this.borderColor = opts.borderColor ?? "#818cf8";
    this.fontSize = opts.fontSize ?? 14;
    this.font = opts.font ?? "sans-serif";
    if (opts.onChange !== undefined) {
      const cb = opts.onChange;
      this.on("change", (v) => cb(v as boolean));
    }
  }

  override triggerClick(): void {
    if (!this.visible) return;
    this.checked = !this.checked;
    this._emit("click");
    this._emit("change", this.checked);
  }

  render(ctx: IUIRenderer, cw: number, ch: number): void {
    if (!this.visible) return;
    const { x, y, h } = this._scaledBounds(cw, ch);
    const boxSize = h;
    ctx.save();
    ctx.globalAlpha = this.alpha;

    ctx.fillStyle = this.background;
    ctx.fillRect(x, y, boxSize, boxSize);
    ctx.strokeStyle = this.borderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, boxSize - 2, boxSize - 2);

    if (this.checked) {
      const p = boxSize * 0.2;
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + p, y + boxSize / 2);
      ctx.lineTo(x + boxSize * 0.45, y + boxSize - p);
      ctx.lineTo(x + boxSize - p, y + p);
      ctx.stroke();
    }

    if (this.label.length > 0) {
      ctx.fillStyle = this.color;
      ctx.font = `${this.fontSize}px ${this.font}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(this.label, x + boxSize + 8, y + h / 2);
    }

    ctx.restore();
    for (const child of this.children) child.render(ctx, cw, ch);
  }
}

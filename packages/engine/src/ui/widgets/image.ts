import type { IUIRenderer } from "@emptysock/types";
import { Widget } from "./base.js";
import type { BaseWidgetOpts } from "./base.js";

export interface ImageWidgetOpts extends BaseWidgetOpts {
  src?: string;
  scaleMode?: "fit" | "fill" | "stretch" | "none";
  tint?: string;
}

export class ImageWidget extends Widget {
  public src: string;
  public scaleMode: "fit" | "fill" | "stretch" | "none";
  public tint: string | undefined;

  _cachedBitmap: ImageBitmap | null = null;
  _loadPending: boolean = false;

  constructor(opts: ImageWidgetOpts = {}) {
    super({ width: opts.width ?? 100, height: opts.height ?? 100, ...opts });
    this.src = opts.src ?? "";
    this.scaleMode = opts.scaleMode ?? "stretch";
    this.tint = opts.tint;
  }

  render(ctx: IUIRenderer, cw: number, ch: number): void {
    if (!this.visible) return;
    const { x, y, w, h } = this._scaledBounds(cw, ch);
    ctx.save();
    ctx.globalAlpha = this.alpha;
    if (this._cachedBitmap !== null) {
      const bw = this._cachedBitmap.width;
      const bh = this._cachedBitmap.height;
      if (this.scaleMode === "stretch" || bw === 0 || bh === 0) {
        ctx.drawImage(this._cachedBitmap, x, y, w, h);
      } else if (this.scaleMode === "none") {
        ctx.drawImage(this._cachedBitmap, x, y, bw, bh);
      } else {
        const scale =
          this.scaleMode === "fit"
            ? Math.min(w / bw, h / bh)
            : Math.max(w / bw, h / bh);
        const dw = bw * scale;
        const dh = bh * scale;
        const dx = x + (w - dw) / 2;
        const dy = y + (h - dh) / 2;
        ctx.save();
        ctx.rect(x, y, w, h);
        ctx.clip();
        ctx.drawImage(this._cachedBitmap, dx, dy, dw, dh);
        ctx.restore();
        ctx.globalAlpha = this.alpha;
      }
    } else {
      ctx.fillStyle = "#555555";
      ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
    for (const child of this.children) child.render(ctx, cw, ch);
  }
}

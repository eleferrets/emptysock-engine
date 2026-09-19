import type { IUIRenderer } from "@emptysock/types";
import { Widget } from "./base.js";
import type { BaseWidgetOpts } from "./base.js";
export interface ImageWidgetOpts extends BaseWidgetOpts {
  src?: string;
  scaleMode?: "fit" | "fill" | "stretch" | "none";
  tint?: string;
}
export declare class ImageWidget extends Widget {
  src: string;
  scaleMode: "fit" | "fill" | "stretch" | "none";
  tint: string | undefined;
  _cachedBitmap: ImageBitmap | null;
  _loadPending: boolean;
  constructor(opts?: ImageWidgetOpts);
  render(ctx: IUIRenderer, cw: number, ch: number): void;
}

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
export declare class LabelWidget extends Widget {
  text: string;
  font: string;
  fontSize: number;
  color: string;
  align: "left" | "center" | "right";
  constructor(opts?: LabelWidgetOpts);
  render(ctx: IUIRenderer, cw: number, ch: number): void;
}

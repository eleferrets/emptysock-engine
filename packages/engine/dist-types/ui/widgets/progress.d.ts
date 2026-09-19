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
export declare class ProgressBarWidget extends Widget {
  value: number;
  min: number;
  max: number;
  fillColor: string;
  trackColor: string;
  direction: "h" | "v";
  constructor(opts?: ProgressBarWidgetOpts);
  get normalised(): number;
  render(ctx: IUIRenderer, cw: number, ch: number): void;
}

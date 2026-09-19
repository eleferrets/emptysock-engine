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
export declare class SliderWidget extends Widget {
  value: number;
  min: number;
  max: number;
  step: number;
  trackColor: string;
  thumbColor: string;
  constructor(opts?: SliderWidgetOpts);
  /** Compute and apply a value from an absolute pointer x coordinate. */
  _applyPointerX(px: number): void;
  get normalised(): number;
  render(ctx: IUIRenderer, cw: number, ch: number): void;
}

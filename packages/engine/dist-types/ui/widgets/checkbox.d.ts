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
export declare class CheckboxWidget extends Widget {
  checked: boolean;
  label: string;
  color: string;
  background: string;
  borderColor: string;
  fontSize: number;
  font: string;
  constructor(opts?: CheckboxWidgetOpts);
  triggerClick(): void;
  render(ctx: IUIRenderer, cw: number, ch: number): void;
}

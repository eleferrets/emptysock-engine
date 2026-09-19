import type { IUIRenderer } from "@emptysock/types";
import { Widget } from "./base.js";
import type { BaseWidgetOpts } from "./base.js";
export interface PanelWidgetOpts extends BaseWidgetOpts {
  background?: string;
  border?: string;
  borderWidth?: number;
  cornerRadius?: number;
}
export declare class PanelWidget extends Widget {
  background: string;
  border: string | undefined;
  borderWidth: number;
  cornerRadius: number;
  constructor(opts?: PanelWidgetOpts);
  render(ctx: IUIRenderer, cw: number, ch: number): void;
}

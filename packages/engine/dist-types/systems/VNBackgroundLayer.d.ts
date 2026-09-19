export interface VNBackgroundLayerOptions {
  canvasWidth: number;
  canvasHeight: number;
  fadeDuration?: number;
}
type FitMode = "cover" | "contain" | "stretch";
export declare class VNBackgroundLayer {
  private _w;
  private _h;
  private _defaultFade;
  private _bg;
  private _cg;
  constructor(opts: VNBackgroundLayerOptions);
  setBackground(
    imagePath: string,
    opts?: {
      fadeDuration?: number;
      fit?: FitMode;
    },
  ): void;
  clearBackground(fadeDuration?: number): void;
  showCG(
    imagePath: string,
    opts?: {
      fadeDuration?: number;
      fit?: FitMode;
    },
  ): void;
  hideCG(fadeDuration?: number): void;
  update(dt: number): void;
  private _tickState;
  render(ctx: CanvasRenderingContext2D): void;
}
export {};

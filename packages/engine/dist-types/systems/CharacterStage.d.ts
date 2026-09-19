export type StageSlot = "left" | "center" | "right";
export interface CharacterStageOptions {
  canvasWidth: number;
  canvasHeight: number;
  /** Vertical position of the bottom edge of a character (0–1, relative to canvas height). Default 0.85 */
  baselineY?: number;
  /** Maximum character height as a fraction of canvas height. Default 0.7 */
  maxHeightFraction?: number;
}
export interface CharacterShowOptions {
  expression?: string;
  fadeDuration?: number;
}
export declare class CharacterStage {
  private _w;
  private _h;
  private _baselineY;
  private _maxH;
  private _slots;
  constructor(opts: CharacterStageOptions);
  show(slot: StageSlot, imagePath: string, opts?: CharacterShowOptions): void;
  hide(slot: StageSlot, fadeDuration?: number): void;
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  /** Remove all characters immediately */
  clear(): void;
}

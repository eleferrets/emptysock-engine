export type StageSlot = 'left' | 'center' | 'right';

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

interface SlotState {
  imagePath: string;
  expression: string;
  image: HTMLImageElement | null;
  opacity: number;
  fadeDir: 1 | -1 | 0;
  fadeDuration: number;
  fadeElapsed: number;
  loaded: boolean;
}

const SLOT_X: Record<StageSlot, number> = {
  left: 0.2,
  center: 0.5,
  right: 0.8,
};

export class CharacterStage {
  private _w: number;
  private _h: number;
  private _baselineY: number;
  private _maxH: number;
  private _slots: Partial<Record<StageSlot, SlotState>> = {};

  constructor(opts: CharacterStageOptions) {
    this._w = opts.canvasWidth;
    this._h = opts.canvasHeight;
    this._baselineY = opts.baselineY ?? 0.85;
    this._maxH = opts.maxHeightFraction ?? 0.7;
  }

  show(slot: StageSlot, imagePath: string, opts: CharacterShowOptions = {}): void {
    const fadeDuration = opts.fadeDuration ?? 0.3;
    const existing = this._slots[slot];
    if (existing && existing.imagePath === imagePath) {
      existing.fadeDir = 1;
      return;
    }
    const img = new Image();
    const state: SlotState = {
      imagePath,
      expression: opts.expression ?? '',
      image: null,
      opacity: 0,
      fadeDir: 1,
      fadeDuration,
      fadeElapsed: 0,
      loaded: false,
    };
    img.onload = () => {
      state.image = img;
      state.loaded = true;
    };
    img.src = imagePath;
    this._slots[slot] = state;
  }

  hide(slot: StageSlot, fadeDuration = 0.3): void {
    const state = this._slots[slot];
    if (!state) return;
    state.fadeDir = -1;
    state.fadeDuration = fadeDuration;
    state.fadeElapsed = fadeDuration * (1 - state.opacity);
  }

  update(dt: number): void {
    for (const key of Object.keys(this._slots) as StageSlot[]) {
      const s = this._slots[key];
      if (!s || s.fadeDir === 0) continue;
      s.fadeElapsed += dt;
      const t = Math.min(s.fadeElapsed / s.fadeDuration, 1);
      s.opacity = s.fadeDir === 1 ? t : 1 - t;
      if (t >= 1) {
        s.fadeDir = 0;
        if (s.opacity <= 0) {
          delete this._slots[key];
        }
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const key of Object.keys(this._slots) as StageSlot[]) {
      const s = this._slots[key];
      if (!s || !s.loaded || !s.image || s.opacity <= 0) continue;
      const img = s.image;
      const maxH = this._h * this._maxH;
      const scale = Math.min(maxH / img.naturalHeight, this._w * 0.4 / img.naturalWidth);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      const cx = this._w * SLOT_X[key];
      const dy = this._h * this._baselineY - dh;
      ctx.save();
      ctx.globalAlpha = s.opacity;
      ctx.drawImage(img, cx - dw / 2, dy, dw, dh);
      ctx.restore();
    }
  }

  /** Remove all characters immediately */
  clear(): void {
    this._slots = {};
  }
}

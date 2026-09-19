export interface VNBackgroundLayerOptions {
  canvasWidth: number;
  canvasHeight: number;
  fadeDuration?: number;
}

type FitMode = 'cover' | 'contain' | 'stretch';

interface LayerState {
  image: HTMLImageElement | null;
  imagePath: string;
  opacity: number;
  fadeDir: 1 | -1 | 0;
  fadeDuration: number;
  fadeElapsed: number;
  fit: FitMode;
}

function makeState(imagePath: string, fadeDuration: number, fit: FitMode): LayerState {
  return { image: null, imagePath, opacity: 0, fadeDir: 1, fadeDuration, fadeElapsed: 0, fit };
}

function drawFit(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number, fit: FitMode): void {
  if (fit === 'stretch') {
    ctx.drawImage(img, 0, 0, w, h);
    return;
  }
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const ir = iw / ih;
  const cr = w / h;
  let sw: number, sh: number, sx: number, sy: number;
  if (fit === 'cover') {
    if (ir > cr) { sh = h; sw = h * ir; } else { sw = w; sh = w / ir; }
  } else {
    if (ir > cr) { sw = w; sh = w / ir; } else { sh = h; sw = h * ir; }
  }
  sx = (w - sw) / 2;
  sy = (h - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh);
}

export class VNBackgroundLayer {
  private _w: number;
  private _h: number;
  private _defaultFade: number;
  private _bg: LayerState | null = null;
  private _cg: LayerState | null = null;

  constructor(opts: VNBackgroundLayerOptions) {
    this._w = opts.canvasWidth;
    this._h = opts.canvasHeight;
    this._defaultFade = opts.fadeDuration ?? 0.5;
  }

  setBackground(imagePath: string, opts: { fadeDuration?: number; fit?: FitMode } = {}): void {
    const fd = opts.fadeDuration ?? this._defaultFade;
    const state = makeState(imagePath, fd, opts.fit ?? 'cover');
    if (typeof document !== 'undefined') {
      const img = new Image();
      img.onload = () => { state.image = img; };
      img.src = imagePath;
    }
    this._bg = state;
  }

  clearBackground(fadeDuration?: number): void {
    if (!this._bg) return;
    this._bg.fadeDir = -1;
    this._bg.fadeDuration = fadeDuration ?? this._defaultFade;
    this._bg.fadeElapsed = this._bg.fadeDuration * (1 - this._bg.opacity);
  }

  showCG(imagePath: string, opts: { fadeDuration?: number; fit?: FitMode } = {}): void {
    const fd = opts.fadeDuration ?? this._defaultFade;
    const state = makeState(imagePath, fd, opts.fit ?? 'contain');
    if (typeof document !== 'undefined') {
      const img = new Image();
      img.onload = () => { state.image = img; };
      img.src = imagePath;
    }
    this._cg = state;
  }

  hideCG(fadeDuration?: number): void {
    if (!this._cg) return;
    this._cg.fadeDir = -1;
    this._cg.fadeDuration = fadeDuration ?? this._defaultFade;
    this._cg.fadeElapsed = this._cg.fadeDuration * (1 - this._cg.opacity);
  }

  update(dt: number): void {
    this._tickState(this._bg, dt, () => { this._bg = null; });
    this._tickState(this._cg, dt, () => { this._cg = null; });
  }

  private _tickState(s: LayerState | null, dt: number, onDone: () => void): void {
    if (!s || s.fadeDir === 0) return;
    s.fadeElapsed += dt;
    const t = Math.min(s.fadeElapsed / s.fadeDuration, 1);
    s.opacity = s.fadeDir === 1 ? t : 1 - t;
    if (t >= 1) {
      s.fadeDir = 0;
      if (s.opacity <= 0) onDone();
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this._bg?.image && this._bg.opacity > 0) {
      ctx.save();
      ctx.globalAlpha = this._bg.opacity;
      drawFit(ctx, this._bg.image, this._w, this._h, this._bg.fit);
      ctx.restore();
    }
    if (this._cg?.image && this._cg.opacity > 0) {
      ctx.save();
      ctx.globalAlpha = this._cg.opacity;
      drawFit(ctx, this._cg.image, this._w, this._h, this._cg.fit);
      ctx.restore();
    }
  }
}

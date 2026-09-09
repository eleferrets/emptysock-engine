import type { IUIRenderer } from "@emptysock/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export type WidgetAnchor =
  | "top-left"
  | "top"
  | "top-right"
  | "left"
  | "center"
  | "right"
  | "bottom-left"
  | "bottom"
  | "bottom-right";

export type AnimationName =
  | "fadeIn"
  | "fadeOut"
  | "slideIn"
  | "slideOut"
  | "pop"
  | "shake";
export type SlideDirection = "left" | "right" | "up" | "down";
export type WidgetEvent = "click" | "hover" | "hoverOut" | "change" | "animEnd";

export interface AnimationOpts {
  duration?: number;
  easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
  direction?: SlideDirection;
}

interface ActiveAnim {
  name: AnimationName;
  elapsed: number;
  duration: number;
  easing: AnimationOpts["easing"];
  direction: SlideDirection;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _nextWidgetId = 0;

function applyEasing(t: number, easing: AnimationOpts["easing"]): number {
  switch (easing) {
    case "ease-in":
      return t * t;
    case "ease-out":
      return 1 - (1 - t) * (1 - t);
    case "ease-in-out":
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    default:
      return t;
  }
}

export function widgetRoundRect(
  ctx: IUIRenderer,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  if (r <= 0) {
    ctx.rect(x, y, w, h);
    return;
  }
  const rr = Math.min(r, w / 2, h / 2);
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, rr);
  } else {
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.arcTo(x + w, y, x + w, y + rr, rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
    ctx.lineTo(x + rr, y + h);
    ctx.arcTo(x, y + h, x, y + h - rr, rr);
    ctx.lineTo(x, y + rr);
    ctx.arcTo(x, y, x + rr, y, rr);
    ctx.closePath();
  }
}

// ─── Base Widget ─────────────────────────────────────────────────────────────

interface BaseWidgetOpts {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  anchor?: WidgetAnchor;
  visible?: boolean;
  alpha?: number;
}

export abstract class Widget {
  public readonly id: number;
  public x: number;
  public y: number;
  public width: number;
  public height: number;
  public anchor: WidgetAnchor;
  public visible: boolean;
  public alpha: number;
  public readonly children: Widget[] = [];

  _anim: ActiveAnim | null = null;
  _animDx: number = 0;
  _animDy: number = 0;
  _scaleX: number = 1;
  _scaleY: number = 1;
  _hovered: boolean = false;

  private readonly _handlers = new Map<
    WidgetEvent,
    Array<(value?: unknown) => void>
  >();

  constructor(opts: BaseWidgetOpts = {}) {
    this.id = _nextWidgetId++;
    this.x = opts.x ?? 0;
    this.y = opts.y ?? 0;
    this.width = opts.width ?? 100;
    this.height = opts.height ?? 40;
    this.anchor = opts.anchor ?? "top-left";
    this.visible = opts.visible ?? true;
    this.alpha = opts.alpha ?? 1;
  }

  on(event: WidgetEvent, handler: (value?: unknown) => void): void {
    let arr = this._handlers.get(event);
    if (arr === undefined) {
      arr = [];
      this._handlers.set(event, arr);
    }
    arr.push(handler);
  }

  off(event: WidgetEvent, handler: (value?: unknown) => void): void {
    const arr = this._handlers.get(event);
    if (arr === undefined) return;
    const idx = arr.indexOf(handler);
    if (idx !== -1) arr.splice(idx, 1);
  }

  _emit(event: WidgetEvent, value?: unknown): void {
    for (const h of this._handlers.get(event) ?? []) h(value);
  }

  animate(name: AnimationName, opts: AnimationOpts = {}): void {
    const duration = (opts.duration ?? 200) / 1000;
    const easing = opts.easing ?? "ease-out";
    const direction = opts.direction ?? "left";
    if (name === "fadeIn") {
      this.alpha = 0;
      this.visible = true;
    }
    this._anim = { name, elapsed: 0, duration, easing, direction };
  }

  _tick(dt: number): void {
    if (this._anim !== null) {
      this._anim.elapsed += dt;
      const raw = Math.min(this._anim.elapsed / this._anim.duration, 1);
      const t = applyEasing(raw, this._anim.easing);
      this._animDx = 0;
      this._animDy = 0;
      this._scaleX = 1;
      this._scaleY = 1;

      switch (this._anim.name) {
        case "fadeIn":
          this.alpha = t;
          break;
        case "fadeOut":
          this.alpha = 1 - t;
          if (raw >= 1) this.visible = false;
          break;
        case "slideIn": {
          const d = 80 * (1 - t);
          switch (this._anim.direction) {
            case "left":
              this._animDx = -d;
              break;
            case "right":
              this._animDx = d;
              break;
            case "up":
              this._animDy = -d;
              break;
            case "down":
              this._animDy = d;
              break;
          }
          break;
        }
        case "slideOut": {
          const d = 80 * t;
          switch (this._anim.direction) {
            case "left":
              this._animDx = -d;
              break;
            case "right":
              this._animDx = d;
              break;
            case "up":
              this._animDy = -d;
              break;
            case "down":
              this._animDy = d;
              break;
          }
          if (raw >= 1) this.visible = false;
          break;
        }
        case "pop": {
          const s =
            raw < 0.5 ? 1 + 0.15 * (raw / 0.5) : 1 + 0.15 * ((1 - raw) / 0.5);
          this._scaleX = s;
          this._scaleY = s;
          break;
        }
        case "shake":
          this._animDx = Math.sin(raw * Math.PI * 10) * 6 * (1 - t);
          break;
      }

      if (raw >= 1) {
        this._anim = null;
        this._emit("animEnd");
      }
    }

    for (const child of this.children) child._tick(dt);
  }

  resolvedPosition(cw: number, ch: number): { x: number; y: number } {
    let ox: number;
    switch (this.anchor) {
      case "top-right":
      case "right":
      case "bottom-right":
        ox = cw - this.width - this.x;
        break;
      case "top":
      case "center":
      case "bottom":
        ox = cw / 2 + this.x - this.width / 2;
        break;
      default:
        ox = this.x;
    }
    let oy: number;
    switch (this.anchor) {
      case "bottom-left":
      case "bottom":
      case "bottom-right":
        oy = ch - this.height - this.y;
        break;
      case "left":
      case "center":
      case "right":
        oy = ch / 2 + this.y - this.height / 2;
        break;
      default:
        oy = this.y;
    }
    return { x: ox + this._animDx, y: oy + this._animDy };
  }

  _scaledBounds(
    cw: number,
    ch: number,
  ): { x: number; y: number; w: number; h: number } {
    const pos = this.resolvedPosition(cw, ch);
    const sw = this.width * this._scaleX;
    const sh = this.height * this._scaleY;
    return {
      x: pos.x + (this.width - sw) / 2,
      y: pos.y + (this.height - sh) / 2,
      w: sw,
      h: sh,
    };
  }

  contains(px: number, py: number, cw: number, ch: number): boolean {
    if (!this.visible) return false;
    const { x, y, w, h } = this._scaledBounds(cw, ch);
    return px >= x && px <= x + w && py >= y && py <= y + h;
  }

  triggerClick(): void {
    if (!this.visible) return;
    this._emit("click");
  }

  _setHovered(hovered: boolean): void {
    if (this._hovered === hovered) return;
    this._hovered = hovered;
    this._emit(hovered ? "hover" : "hoverOut");
  }

  abstract render(ctx: IUIRenderer, cw: number, ch: number): void;
}

// ─── LabelWidget ─────────────────────────────────────────────────────────────

export interface LabelWidgetOpts extends BaseWidgetOpts {
  text?: string;
  font?: string;
  fontSize?: number;
  color?: string;
  align?: "left" | "center" | "right";
}

export class LabelWidget extends Widget {
  public text: string;
  public font: string;
  public fontSize: number;
  public color: string;
  public align: "left" | "center" | "right";

  constructor(opts: LabelWidgetOpts = {}) {
    super({
      width: opts.width ?? 200,
      height: opts.height ?? (opts.fontSize ?? 14) * 1.5,
      ...opts,
    });
    this.text = opts.text ?? "";
    this.font = opts.font ?? "sans-serif";
    this.fontSize = opts.fontSize ?? 14;
    this.color = opts.color ?? "#ffffff";
    this.align = opts.align ?? "left";
  }

  render(ctx: IUIRenderer, cw: number, ch: number): void {
    if (!this.visible) return;
    const { x, y, w, h } = this._scaledBounds(cw, ch);
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.font = `${this.fontSize}px ${this.font}`;
    ctx.textAlign = this.align;
    ctx.textBaseline = "middle";
    const tx =
      this.align === "right" ? x + w : this.align === "center" ? x + w / 2 : x;
    ctx.fillText(this.text, tx, y + h / 2);
    ctx.restore();
    for (const child of this.children) child.render(ctx, cw, ch);
  }
}

// ─── ImageWidget ─────────────────────────────────────────────────────────────

export interface ImageWidgetOpts extends BaseWidgetOpts {
  src?: string;
  scaleMode?: "fit" | "fill" | "stretch" | "none";
  tint?: string;
}

export class ImageWidget extends Widget {
  public src: string;
  public scaleMode: "fit" | "fill" | "stretch" | "none";
  public tint: string | undefined;

  _cachedBitmap: ImageBitmap | null = null;
  _loadPending: boolean = false;

  constructor(opts: ImageWidgetOpts = {}) {
    super({ width: opts.width ?? 100, height: opts.height ?? 100, ...opts });
    this.src = opts.src ?? "";
    this.scaleMode = opts.scaleMode ?? "stretch";
    this.tint = opts.tint;
  }

  render(ctx: IUIRenderer, cw: number, ch: number): void {
    if (!this.visible) return;
    const { x, y, w, h } = this._scaledBounds(cw, ch);
    ctx.save();
    ctx.globalAlpha = this.alpha;
    if (this._cachedBitmap !== null) {
      ctx.drawImage(this._cachedBitmap, x, y, w, h);
    } else {
      ctx.fillStyle = "#555555";
      ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
    for (const child of this.children) child.render(ctx, cw, ch);
  }
}

// ─── ButtonWidget ─────────────────────────────────────────────────────────────

export type ButtonState = "normal" | "hover" | "pressed" | "disabled";

export interface ButtonWidgetOpts extends BaseWidgetOpts {
  label?: string;
  icon?: string;
  color?: string;
  background?: string;
  hoverBackground?: string;
  pressedBackground?: string;
  borderRadius?: number;
  fontSize?: number;
  font?: string;
  disabled?: boolean;
  animateOnHover?: boolean;
}

export class ButtonWidget extends Widget {
  public label: string;
  public icon: string | undefined;
  public color: string;
  public background: string;
  public hoverBackground: string;
  public pressedBackground: string;
  public borderRadius: number;
  public fontSize: number;
  public font: string;
  public disabled: boolean;
  public animateOnHover: boolean;

  private _btnState: ButtonState = "normal";

  constructor(opts: ButtonWidgetOpts = {}) {
    super({ width: opts.width ?? 120, height: opts.height ?? 36, ...opts });
    this.label = opts.label ?? "Button";
    this.icon = opts.icon;
    this.color = opts.color ?? "#ffffff";
    this.background = opts.background ?? "#3a3a5c";
    this.hoverBackground = opts.hoverBackground ?? "#4a4a7c";
    this.pressedBackground = opts.pressedBackground ?? "#2a2a4c";
    this.borderRadius = opts.borderRadius ?? 4;
    this.fontSize = opts.fontSize ?? 14;
    this.font = opts.font ?? "sans-serif";
    this.disabled = opts.disabled ?? false;
    this.animateOnHover = opts.animateOnHover ?? true;
  }

  get state(): ButtonState {
    return this._btnState;
  }

  override _setHovered(hovered: boolean): void {
    if (this._hovered === hovered) return;
    this._hovered = hovered;
    if (this.disabled) return;
    this._btnState = hovered ? "hover" : "normal";
    this._emit(hovered ? "hover" : "hoverOut");
    if (hovered && this.animateOnHover) this.animate("pop", { duration: 120 });
  }

  override triggerClick(): void {
    if (this.disabled || !this.visible) return;
    this._emit("click");
  }

  render(ctx: IUIRenderer, cw: number, ch: number): void {
    if (!this.visible) return;
    const { x, y, w, h } = this._scaledBounds(cw, ch);
    ctx.save();
    ctx.globalAlpha = this.alpha * (this.disabled ? 0.5 : 1);

    const bg =
      this._btnState === "hover"
        ? this.hoverBackground
        : this._btnState === "pressed"
          ? this.pressedBackground
          : this.background;

    ctx.fillStyle = bg;
    ctx.beginPath();
    widgetRoundRect(ctx, x, y, w, h, this.borderRadius);
    ctx.fill();

    ctx.fillStyle = this.color;
    ctx.font = `${this.fontSize}px ${this.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.label, x + w / 2, y + h / 2);

    ctx.restore();
    for (const child of this.children) child.render(ctx, cw, ch);
  }
}

// ─── PanelWidget ──────────────────────────────────────────────────────────────

export interface PanelWidgetOpts extends BaseWidgetOpts {
  background?: string;
  border?: string;
  borderWidth?: number;
  cornerRadius?: number;
}

export class PanelWidget extends Widget {
  public background: string;
  public border: string | undefined;
  public borderWidth: number;
  public cornerRadius: number;

  constructor(opts: PanelWidgetOpts = {}) {
    super({ width: opts.width ?? 200, height: opts.height ?? 150, ...opts });
    this.background = opts.background ?? "#1a1a2e";
    this.border = opts.border;
    this.borderWidth = opts.borderWidth ?? 1;
    this.cornerRadius = opts.cornerRadius ?? 6;
  }

  render(ctx: IUIRenderer, cw: number, ch: number): void {
    if (!this.visible) return;
    const { x, y, w, h } = this._scaledBounds(cw, ch);
    ctx.save();
    ctx.globalAlpha = this.alpha;

    ctx.fillStyle = this.background;
    ctx.beginPath();
    widgetRoundRect(ctx, x, y, w, h, this.cornerRadius);
    ctx.fill();

    if (this.border !== undefined) {
      ctx.strokeStyle = this.border;
      ctx.lineWidth = this.borderWidth;
      ctx.beginPath();
      widgetRoundRect(ctx, x, y, w, h, this.cornerRadius);
      ctx.stroke();
    }

    ctx.restore();
    for (const child of this.children) child.render(ctx, cw, ch);
  }
}

// ─── ProgressBarWidget ────────────────────────────────────────────────────────

export interface ProgressBarWidgetOpts extends BaseWidgetOpts {
  value?: number;
  min?: number;
  max?: number;
  fillColor?: string;
  trackColor?: string;
  direction?: "h" | "v";
}

export class ProgressBarWidget extends Widget {
  public value: number;
  public min: number;
  public max: number;
  public fillColor: string;
  public trackColor: string;
  public direction: "h" | "v";

  constructor(opts: ProgressBarWidgetOpts = {}) {
    super({ width: opts.width ?? 200, height: opts.height ?? 12, ...opts });
    this.value = opts.value ?? 0;
    this.min = opts.min ?? 0;
    this.max = opts.max ?? 1;
    this.fillColor = opts.fillColor ?? "#4caf50";
    this.trackColor = opts.trackColor ?? "#333333";
    this.direction = opts.direction ?? "h";
  }

  get normalised(): number {
    return Math.min(
      1,
      Math.max(0, (this.value - this.min) / (this.max - this.min)),
    );
  }

  render(ctx: IUIRenderer, cw: number, ch: number): void {
    if (!this.visible) return;
    const { x, y, w, h } = this._scaledBounds(cw, ch);
    const n = this.normalised;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.trackColor;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = this.fillColor;
    if (this.direction === "h") {
      ctx.fillRect(x, y, w * n, h);
    } else {
      ctx.fillRect(x, y + h * (1 - n), w, h * n);
    }
    ctx.restore();
    for (const child of this.children) child.render(ctx, cw, ch);
  }
}

// ─── SliderWidget ─────────────────────────────────────────────────────────────

export interface SliderWidgetOpts extends BaseWidgetOpts {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  trackColor?: string;
  thumbColor?: string;
  onChange?: (value: number) => void;
}

export class SliderWidget extends Widget {
  public value: number;
  public min: number;
  public max: number;
  public step: number;
  public trackColor: string;
  public thumbColor: string;

  constructor(opts: SliderWidgetOpts = {}) {
    super({ width: opts.width ?? 200, height: opts.height ?? 20, ...opts });
    this.value = opts.value ?? 0;
    this.min = opts.min ?? 0;
    this.max = opts.max ?? 1;
    this.step = opts.step ?? 0;
    this.trackColor = opts.trackColor ?? "#555555";
    this.thumbColor = opts.thumbColor ?? "#818cf8";
    if (opts.onChange !== undefined) {
      const cb = opts.onChange;
      this.on("change", (v) => cb(v as number));
    }
  }

  get normalised(): number {
    return Math.min(
      1,
      Math.max(0, (this.value - this.min) / (this.max - this.min)),
    );
  }

  render(ctx: IUIRenderer, cw: number, ch: number): void {
    if (!this.visible) return;
    const { x, y, w, h } = this._scaledBounds(cw, ch);
    const n = this.normalised;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    const trackH = Math.max(4, h * 0.25);
    const trackY = y + (h - trackH) / 2;
    ctx.fillStyle = this.trackColor;
    ctx.fillRect(x, trackY, w, trackH);
    const thumbR = h * 0.4;
    ctx.fillStyle = this.thumbColor;
    ctx.beginPath();
    ctx.arc(x + w * n, y + h / 2, thumbR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    for (const child of this.children) child.render(ctx, cw, ch);
  }
}

// ─── CheckboxWidget ───────────────────────────────────────────────────────────

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

export class CheckboxWidget extends Widget {
  public checked: boolean;
  public label: string;
  public color: string;
  public background: string;
  public borderColor: string;
  public fontSize: number;
  public font: string;

  constructor(opts: CheckboxWidgetOpts = {}) {
    const boxSize = opts.height ?? 20;
    const labelText = opts.label ?? "";
    super({
      width:
        opts.width ??
        (labelText.length > 0
          ? boxSize + 8 + labelText.length * (opts.fontSize ?? 14) * 0.6
          : boxSize),
      height: boxSize,
      ...opts,
    });
    this.checked = opts.checked ?? false;
    this.label = labelText;
    this.color = opts.color ?? "#ffffff";
    this.background = opts.background ?? "#1a1a2e";
    this.borderColor = opts.borderColor ?? "#818cf8";
    this.fontSize = opts.fontSize ?? 14;
    this.font = opts.font ?? "sans-serif";
    if (opts.onChange !== undefined) {
      const cb = opts.onChange;
      this.on("change", (v) => cb(v as boolean));
    }
  }

  override triggerClick(): void {
    if (!this.visible) return;
    this.checked = !this.checked;
    this._emit("click");
    this._emit("change", this.checked);
  }

  render(ctx: IUIRenderer, cw: number, ch: number): void {
    if (!this.visible) return;
    const { x, y, h } = this._scaledBounds(cw, ch);
    const boxSize = h;
    ctx.save();
    ctx.globalAlpha = this.alpha;

    ctx.fillStyle = this.background;
    ctx.fillRect(x, y, boxSize, boxSize);
    ctx.strokeStyle = this.borderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, boxSize - 2, boxSize - 2);

    if (this.checked) {
      const p = boxSize * 0.2;
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + p, y + boxSize / 2);
      ctx.lineTo(x + boxSize * 0.45, y + boxSize - p);
      ctx.lineTo(x + boxSize - p, y + p);
      ctx.stroke();
    }

    if (this.label.length > 0) {
      ctx.fillStyle = this.color;
      ctx.font = `${this.fontSize}px ${this.font}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(this.label, x + boxSize + 8, y + h / 2);
    }

    ctx.restore();
    for (const child of this.children) child.render(ctx, cw, ch);
  }
}

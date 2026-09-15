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

export function applyEasing(
  t: number,
  easing: AnimationOpts["easing"],
): number {
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

export interface BaseWidgetOpts {
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

// Minimal runtime UI system — framework-agnostic, works without a DOM.
// The render layer is responsible for actually drawing; this system tracks layout.

import type { ImageLoader, IUIRenderer } from '@emptysock/types';

export type UIAnchor =
  | 'top-left' | 'top-center' | 'top-right'
  | 'middle-left' | 'middle-center' | 'middle-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

export type UIComponentType = 'panel' | 'button' | 'text' | 'image' | 'slider' | 'toggle' | 'progress-bar';

export interface UIStyle {
  backgroundColor?: number;
  color?: number;
  fontSize?: number;
  fontFamily?: string;
  borderColor?: number;
  borderWidth?: number;
  borderRadius?: number;
  opacity?: number;
  padding?: number;
}

export interface UIComponentOptions {
  type: UIComponentType;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  anchor?: UIAnchor;
  text?: string;
  style?: UIStyle;
  visible?: boolean;
  interactive?: boolean;
}

let _nextUIId = 0;

// ─── Animation types ─────────────────────────────────────────────────────────

export type UIAnimationType = 'fade-in' | 'fade-out' | 'slide-in-left' | 'slide-in-right' | 'slide-in-up' | 'slide-in-down';

interface UIAnimState {
  type: UIAnimationType;
  t: number;         // elapsed seconds
  duration: number;  // total seconds
  /** slide distance in pixels (positive = how far it starts from final position) */
  slideDistance: number;
}

export class UIComponent {
  public readonly id: number;
  public readonly type: UIComponentType;
  public x: number;
  public y: number;
  public width: number;
  public height: number;
  public anchor: UIAnchor;
  public text: string;
  public style: UIStyle;
  public visible: boolean;
  public interactive: boolean;
  private readonly _children: UIComponent[] = [];

  // Animation
  _anim: UIAnimState | null = null;
  /** Style overlay applied while the pointer is over this component. */
  _hoverStyle: UIStyle | null = null;
  _hovered: boolean = false;
  /** Base opacity from style — preserved across fade animations. */
  private _baseOpacity: number = 1;
  private _parent: UIComponent | null = null;
  private _clickHandlers: Array<() => void> = [];
  private _changeHandlers: Array<(value: number | boolean) => void> = [];

  /** For slider/progress-bar: current value 0..1 */
  public value: number = 0;
  /** For toggle: current state */
  public checked: boolean = false;

  constructor(options: UIComponentOptions) {
    this.id = _nextUIId++;
    this.type = options.type;
    this.x = options.x ?? 0;
    this.y = options.y ?? 0;
    this.width = options.width ?? 100;
    this.height = options.height ?? 40;
    this.anchor = options.anchor ?? 'top-left';
    this.text = options.text ?? '';
    this.style = options.style ?? {};
    this.visible = options.visible ?? true;
    this.interactive = options.interactive ?? true;
  }

  // ─── Hierarchy ──────────────────────────────────────────────────────────────

  createChild(type: UIComponentType, options: Omit<UIComponentOptions, 'type'> & { text?: string } = {}): UIComponent {
    const child = new UIComponent({ ...options, type });
    child._parent = this;
    this._children.push(child);
    return child;
  }

  get children(): ReadonlyArray<UIComponent> { return this._children; }
  get parent(): UIComponent | null { return this._parent; }

  removeChild(child: UIComponent): void {
    const idx = this._children.indexOf(child);
    if (idx !== -1) { this._children.splice(idx, 1); child._parent = null; }
  }

  // ─── Events ─────────────────────────────────────────────────────────────────

  onClick(handler: () => void): this {
    this._clickHandlers.push(handler);
    return this;
  }

  onChange(handler: (value: number | boolean) => void): this {
    this._changeHandlers.push(handler);
    return this;
  }

  // ─── Animations ─────────────────────────────────────────────────────────────

  /**
   * Play a fade-in animation. The component starts transparent and reaches its
   * target opacity over `duration` seconds. May be called immediately after creation.
   */
  fadeIn(duration: number = 0.3): this {
    this._baseOpacity = this.style.opacity ?? 1;
    this.style = { ...this.style, opacity: 0 };
    this.visible = true;
    this._anim = { type: 'fade-in', t: 0, duration, slideDistance: 0 };
    return this;
  }

  /**
   * Play a fade-out animation. Sets `visible = false` when complete.
   */
  fadeOut(duration: number = 0.3): this {
    this._baseOpacity = this.style.opacity ?? 1;
    this._anim = { type: 'fade-out', t: 0, duration, slideDistance: 0 };
    return this;
  }

  /**
   * Slide the component in from off-screen (`direction` side) over `duration`
   * seconds, moving `distance` pixels. The component ends at its declared x/y.
   */
  slideIn(direction: 'left' | 'right' | 'up' | 'down', distance: number = 40, duration: number = 0.3): this {
    this.visible = true;
    const type = `slide-in-${direction}` as UIAnimationType;
    this._anim = { type, t: 0, duration, slideDistance: distance };
    return this;
  }

  /**
   * Set a style overlay applied while the pointer hovers over this component.
   * Pass `null` to remove hover styling.
   */
  setHoverStyle(hoverStyle: UIStyle | null): this {
    this._hoverStyle = hoverStyle;
    return this;
  }

  /** Read-only: whether the pointer is currently over this component. */
  get hovered(): boolean { return this._hovered; }

  /** @internal tick called by UISystemImpl.update() */
  _tickAnim(dt: number): void {
    if (this._anim === null) return;
    this._anim.t += dt;
    const progress = Math.min(this._anim.t / this._anim.duration, 1);
    const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2; // ease-in-out quad

    if (this._anim.type === 'fade-in') {
      this.style = { ...this.style, opacity: eased * this._baseOpacity };
    } else if (this._anim.type === 'fade-out') {
      this.style = { ...this.style, opacity: (1 - eased) * this._baseOpacity };
      if (progress >= 1) this.visible = false;
    }

    if (progress >= 1) this._anim = null;
  }

  /** @internal animation offset applied during render (does not mutate x/y) */
  _animOffset(): { dx: number; dy: number } {
    if (this._anim === null) return { dx: 0, dy: 0 };
    const progress = Math.min(this._anim.t / this._anim.duration, 1);
    const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    const remaining = (1 - eased) * this._anim.slideDistance;
    switch (this._anim.type) {
      case 'slide-in-left':  return { dx: -remaining, dy: 0 };
      case 'slide-in-right': return { dx:  remaining, dy: 0 };
      case 'slide-in-up':    return { dx: 0, dy: -remaining };
      case 'slide-in-down':  return { dx: 0, dy:  remaining };
      default: return { dx: 0, dy: 0 };
    }
  }

  /** Called by the input/render layer when a click is detected on this component. */
  triggerClick(): void {
    if (!this.interactive || !this.visible) return;
    if (this.type === 'toggle') {
      this.checked = !this.checked;
      for (const h of this._changeHandlers) h(this.checked);
    }
    for (const h of this._clickHandlers) h();
  }

  triggerChange(value: number | boolean): void {
    if (typeof value === 'number') this.value = value;
    if (typeof value === 'boolean') this.checked = value;
    for (const h of this._changeHandlers) h(value);
  }

  /** Resolved screen-space top-left based on canvas size and anchor. */
  resolvedPosition(canvasWidth: number, canvasHeight: number): { x: number; y: number } {
    let ox: number;
    if (this.anchor.includes('right')) {
      ox = canvasWidth - this.width - this.x;
    } else if (this.anchor.includes('center')) {
      ox = canvasWidth / 2 + this.x - this.width / 2;
    } else {
      ox = this.x;
    }

    let oy: number;
    if (this.anchor.includes('bottom')) {
      oy = canvasHeight - this.height - this.y;
    } else if (this.anchor.includes('middle')) {
      oy = canvasHeight / 2 + this.y - this.height / 2;
    } else {
      oy = this.y;
    }

    return { x: ox, y: oy };
  }

  /** Hit-test a canvas-space point. Returns true if inside this component. */
  contains(px: number, py: number, canvasWidth: number, canvasHeight: number): boolean {
    if (!this.visible || !this.interactive) return false;
    const { x, y } = this.resolvedPosition(canvasWidth, canvasHeight);
    return px >= x && px <= x + this.width && py >= y && py <= y + this.height;
  }
}

// ─── Render helpers ───────────────────────────────────────────────────────────

function roundRect(ctx: IUIRenderer, x: number, y: number, w: number, h: number, r: number): void {
  if (r <= 0) {
    ctx.rect(x, y, w, h);
    return;
  }
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
}

function numToHex(n: number): string {
  return '#' + (n >>> 0).toString(16).padStart(6, '0');
}

function buildFont(comp: UIComponent): string {
  return `${comp.style.fontSize ?? 14}px ${comp.style.fontFamily ?? 'sans-serif'}`;
}

// ─── System singleton ─────────────────────────────────────────────────────────

class UISystemImpl {
  private readonly _roots: UIComponent[] = [];
  private readonly _imageLoader: ImageLoader | undefined;
  private readonly _imageCache: Map<string, ImageBitmap> = new Map();
  private readonly _imagePending: Set<string> = new Set();

  constructor(imageLoader?: ImageLoader) {
    this._imageLoader = imageLoader;
  }

  create(type: UIComponentType, options: Omit<UIComponentOptions, 'type'> = {}): UIComponent {
    const comp = new UIComponent({ ...options, type });
    this._roots.push(comp);
    return comp;
  }

  remove(comp: UIComponent): void {
    const idx = this._roots.indexOf(comp);
    if (idx !== -1) this._roots.splice(idx, 1);
  }

  /** Hit-test and dispatch click to the topmost matching component. */
  handleClick(x: number, y: number, canvasWidth: number, canvasHeight: number): boolean {
    const hit = this._findHit(this._roots, x, y, canvasWidth, canvasHeight);
    if (hit !== null) { hit.triggerClick(); return true; }
    return false;
  }

  private _findHit(
    comps: ReadonlyArray<UIComponent>,
    x: number, y: number, cw: number, ch: number
  ): UIComponent | null {
    for (let i = comps.length - 1; i >= 0; i--) {
      const c = comps[i];
      if (c === undefined) continue;
      const child = this._findHit(c.children, x, y, cw, ch);
      if (child !== null) return child;
      if (c.contains(x, y, cw, ch)) return c;
    }
    return null;
  }

  get roots(): ReadonlyArray<UIComponent> { return this._roots; }

  clear(): void { this._roots.length = 0; }

  /** Alias for handleClick — preferred name for pointer-down dispatch. */
  dispatchPointerDown(x: number, y: number, canvasWidth: number, canvasHeight: number): boolean {
    return this.handleClick(x, y, canvasWidth, canvasHeight);
  }

  /**
   * Advance all active animations and update hover state.
   * Call once per frame before `render()`, passing the frame delta-time in seconds.
   */
  update(dt: number, pointerX?: number, pointerY?: number, canvasWidth?: number, canvasHeight?: number): void {
    this._tickAnimsInList(this._roots, dt);

    if (pointerX !== undefined && pointerY !== undefined && canvasWidth !== undefined && canvasHeight !== undefined) {
      this._updateHover(this._roots, pointerX, pointerY, canvasWidth, canvasHeight);
    }
  }

  /**
   * Update hover state for all components given the current pointer position.
   * Call from a pointermove / mousemove event handler.
   */
  handlePointerMove(x: number, y: number, canvasWidth: number, canvasHeight: number): void {
    this._updateHover(this._roots, x, y, canvasWidth, canvasHeight);
  }

  private _tickAnimsInList(comps: ReadonlyArray<UIComponent>, dt: number): void {
    for (const c of comps) {
      c._tickAnim(dt);
      this._tickAnimsInList(c.children, dt);
    }
  }

  private _updateHover(comps: ReadonlyArray<UIComponent>, px: number, py: number, cw: number, ch: number): void {
    for (const c of comps) {
      const wasHovered = c._hovered;
      c._hovered = c._hoverStyle !== null && c.contains(px, py, cw, ch);
      if (c._hovered !== wasHovered && c._hoverStyle !== null) {
        // nothing extra — the render pass reads _hovered each frame
      }
      this._updateHover(c.children, px, py, cw, ch);
    }
  }

  /** Draw all root UI components and their children to the given canvas context. */
  render(ctx: IUIRenderer, canvasWidth: number, canvasHeight: number): void {
    for (const root of this._roots) {
      this._renderComponent(ctx, root, canvasWidth, canvasHeight);
    }
  }

  private _renderComponent(
    ctx: IUIRenderer,
    comp: UIComponent,
    cw: number,
    ch: number
  ): void {
    if (!comp.visible) return;

    const { x: rx, y: ry } = comp.resolvedPosition(cw, ch);
    const { dx, dy } = comp._animOffset();
    const x = rx + dx;
    const y = ry + dy;
    const w = comp.width;
    const h = comp.height;

    // Merge hover style on top of base style when hovered
    const style: UIStyle = comp._hovered && comp._hoverStyle !== null
      ? { ...comp.style, ...comp._hoverStyle }
      : comp.style;

    ctx.save();
    ctx.globalAlpha = style.opacity ?? 1;

    switch (comp.type) {
      case 'panel': {
        const pr = style.borderRadius ?? 0;
        ctx.fillStyle = numToHex(style.backgroundColor ?? 0x1a1a2e);
        ctx.beginPath();
        roundRect(ctx, x, y, w, h, pr);
        ctx.fill();
        if (style.borderColor !== undefined && style.borderWidth !== undefined) {
          ctx.strokeStyle = numToHex(style.borderColor);
          ctx.lineWidth = style.borderWidth;
          ctx.beginPath();
          roundRect(ctx, x, y, w, h, pr);
          ctx.stroke();
        }
        break;
      }
      case 'button': {
        const br = style.borderRadius ?? 0;
        ctx.fillStyle = numToHex(style.backgroundColor ?? 0x1a1a2e);
        ctx.beginPath();
        roundRect(ctx, x, y, w, h, br);
        ctx.fill();
        if (style.borderColor !== undefined && style.borderWidth !== undefined) {
          ctx.strokeStyle = numToHex(style.borderColor);
          ctx.lineWidth = style.borderWidth;
          ctx.beginPath();
          roundRect(ctx, x, y, w, h, br);
          ctx.stroke();
        }
        ctx.fillStyle = numToHex(style.color ?? 0xffffff);
        ctx.font = buildFont(comp);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(comp.text, x + w / 2, y + h / 2);
        break;
      }
      case 'text': {
        ctx.fillStyle = numToHex(style.color ?? 0xffffff);
        ctx.font = buildFont(comp);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(comp.text, x, y);
        break;
      }
      case 'image': {
        const src = comp.text;
        const cached = src.length > 0 ? this._imageCache.get(src) : undefined;
        if (cached !== undefined) {
          ctx.drawImage(cached, x, y, w, h);
        } else {
          // Grey placeholder until the loader resolves (or if no loader is injected).
          ctx.fillStyle = '#888888';
          ctx.fillRect(x, y, w, h);
          if (this._imageLoader !== undefined && src.length > 0 && !this._imagePending.has(src)) {
            this._imagePending.add(src);
            this._imageLoader.load(src).then((result) => {
              if (result instanceof ImageBitmap) {
                this._imageCache.set(src, result);
              }
              this._imagePending.delete(src);
            }).catch(() => {
              this._imagePending.delete(src);
            });
          }
        }
        break;
      }
      case 'progress-bar': {
        ctx.fillStyle = numToHex(style.backgroundColor ?? 0x333333);
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = numToHex(style.color ?? 0x4caf50);
        ctx.fillRect(x, y, w * Math.min(1, Math.max(0, comp.value)), h);
        break;
      }
      case 'slider': {
        const trackH = Math.max(4, h * 0.25);
        const trackY = y + (h - trackH) / 2;
        ctx.fillStyle = numToHex(style.backgroundColor ?? 0x555555);
        ctx.fillRect(x, trackY, w, trackH);
        const thumbX = x + w * Math.min(1, Math.max(0, comp.value));
        const thumbR = h * 0.4;
        ctx.fillStyle = numToHex(style.color ?? 0xffffff);
        ctx.beginPath();
        ctx.arc(thumbX, y + h / 2, thumbR, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'toggle': {
        ctx.fillStyle = numToHex(style.backgroundColor ?? 0x333333);
        ctx.fillRect(x, y, w, h);
        if (style.borderColor !== undefined && style.borderWidth !== undefined) {
          ctx.strokeStyle = numToHex(style.borderColor);
          ctx.lineWidth = style.borderWidth;
          ctx.strokeRect(x, y, w, h);
        }
        if (comp.checked) {
          ctx.strokeStyle = numToHex(style.color ?? 0xffffff);
          ctx.lineWidth = 2;
          const pad = Math.min(w, h) * 0.2;
          ctx.beginPath();
          ctx.moveTo(x + pad, y + pad);
          ctx.lineTo(x + w - pad, y + h - pad);
          ctx.moveTo(x + w - pad, y + pad);
          ctx.lineTo(x + pad, y + h - pad);
          ctx.stroke();
        }
        break;
      }
    }

    ctx.restore();

    for (const child of comp.children) {
      this._renderComponent(ctx, child, cw, ch);
    }
  }
}

export const UISystem = new UISystemImpl();

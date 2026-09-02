// Minimal runtime UI system — framework-agnostic, works without a DOM.
// The render layer is responsible for actually drawing; this system tracks layout.

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
    let ox = this.x;
    let oy = this.y;
    if (this.anchor.includes('center') || this.anchor.includes('middle')) {
      if (this.anchor.includes('center')) ox = canvasWidth / 2 + this.x - this.width / 2;
      if (this.anchor.includes('right')) ox = canvasWidth - this.width - this.x;
      if (this.anchor.includes('middle')) oy = canvasHeight / 2 + this.y - this.height / 2;
    }
    if (this.anchor.includes('right') && !this.anchor.includes('center')) ox = canvasWidth - this.width - this.x;
    if (this.anchor.includes('bottom')) oy = canvasHeight - this.height - this.y;
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

function numToHex(n: number): string {
  return '#' + (n >>> 0).toString(16).padStart(6, '0');
}

function buildFont(comp: UIComponent): string {
  return `${comp.style.fontSize ?? 14}px ${comp.style.fontFamily ?? 'sans-serif'}`;
}

// ─── System singleton ─────────────────────────────────────────────────────────

class UISystemImpl {
  private readonly _roots: UIComponent[] = [];

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
      const c = comps[i]!;
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

  /** Draw all root UI components and their children to the given canvas context. */
  render(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
    for (const root of this._roots) {
      this._renderComponent(ctx, root, canvasWidth, canvasHeight);
    }
  }

  private _renderComponent(
    ctx: CanvasRenderingContext2D,
    comp: UIComponent,
    cw: number,
    ch: number
  ): void {
    if (!comp.visible) return;

    const { x, y } = comp.resolvedPosition(cw, ch);
    const w = comp.width;
    const h = comp.height;

    ctx.save();
    ctx.globalAlpha = comp.style.opacity ?? 1;

    switch (comp.type) {
      case 'panel': {
        ctx.fillStyle = numToHex(comp.style.backgroundColor ?? 0x1a1a2e);
        ctx.fillRect(x, y, w, h);
        if (comp.style.borderColor !== undefined && comp.style.borderWidth !== undefined) {
          ctx.strokeStyle = numToHex(comp.style.borderColor);
          ctx.lineWidth = comp.style.borderWidth;
          ctx.strokeRect(x, y, w, h);
        }
        break;
      }
      case 'button': {
        ctx.fillStyle = numToHex(comp.style.backgroundColor ?? 0x1a1a2e);
        ctx.fillRect(x, y, w, h);
        if (comp.style.borderColor !== undefined && comp.style.borderWidth !== undefined) {
          ctx.strokeStyle = numToHex(comp.style.borderColor);
          ctx.lineWidth = comp.style.borderWidth;
          ctx.strokeRect(x, y, w, h);
        }
        ctx.fillStyle = numToHex(comp.style.color ?? 0xffffff);
        ctx.font = buildFont(comp);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(comp.text, x + w / 2, y + h / 2);
        break;
      }
      case 'text': {
        ctx.fillStyle = numToHex(comp.style.color ?? 0xffffff);
        ctx.font = buildFont(comp);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(comp.text, x, y);
        break;
      }
      case 'image': {
        // Placeholder — no image loading in engine; the caller supplies a canvas.
        ctx.fillStyle = '#888888';
        ctx.fillRect(x, y, w, h);
        break;
      }
      case 'progress-bar': {
        ctx.fillStyle = numToHex(comp.style.backgroundColor ?? 0x333333);
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = numToHex(comp.style.color ?? 0x4caf50);
        ctx.fillRect(x, y, w * Math.min(1, Math.max(0, comp.value)), h);
        break;
      }
      case 'slider': {
        const trackH = Math.max(4, h * 0.25);
        const trackY = y + (h - trackH) / 2;
        ctx.fillStyle = numToHex(comp.style.backgroundColor ?? 0x555555);
        ctx.fillRect(x, trackY, w, trackH);
        const thumbX = x + w * Math.min(1, Math.max(0, comp.value));
        const thumbR = h * 0.4;
        ctx.fillStyle = numToHex(comp.style.color ?? 0xffffff);
        ctx.beginPath();
        ctx.arc(thumbX, y + h / 2, thumbR, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'toggle': {
        ctx.fillStyle = numToHex(comp.style.backgroundColor ?? 0x333333);
        ctx.fillRect(x, y, w, h);
        if (comp.style.borderColor !== undefined && comp.style.borderWidth !== undefined) {
          ctx.strokeStyle = numToHex(comp.style.borderColor);
          ctx.lineWidth = comp.style.borderWidth;
          ctx.strokeRect(x, y, w, h);
        }
        if (comp.checked) {
          ctx.strokeStyle = numToHex(comp.style.color ?? 0xffffff);
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

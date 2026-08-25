export type KeyState = 'up' | 'down' | 'pressed' | 'released';

export interface MouseState {
  x: number;
  y: number;
  dx: number;
  dy: number;
  buttons: Record<number, boolean>;
}

export class InputSystem {
  private readonly _keys: Map<string, boolean> = new Map();
  private readonly _prevKeys: Map<string, boolean> = new Map();
  private readonly _mouse: MouseState = { x: 0, y: 0, dx: 0, dy: 0, buttons: {} };
  private readonly _prevMouseButtons: Record<number, boolean> = {};
  private _boundTarget: EventTarget | null = null;

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  attach(target: EventTarget = window): void {
    this._boundTarget = target;
    target.addEventListener('keydown', this._onKeyDown);
    target.addEventListener('keyup', this._onKeyUp);
    target.addEventListener('mousemove', this._onMouseMove);
    target.addEventListener('mousedown', this._onMouseDown);
    target.addEventListener('mouseup', this._onMouseUp);
  }

  detach(): void {
    if (this._boundTarget === null) return;
    this._boundTarget.removeEventListener('keydown', this._onKeyDown);
    this._boundTarget.removeEventListener('keyup', this._onKeyUp);
    this._boundTarget.removeEventListener('mousemove', this._onMouseMove);
    this._boundTarget.removeEventListener('mousedown', this._onMouseDown);
    this._boundTarget.removeEventListener('mouseup', this._onMouseUp);
    this._boundTarget = null;
  }

  /** Call at end of each frame to flush pressed/released states */
  flush(): void {
    this._prevKeys.clear();
    for (const [k, v] of this._keys) {
      this._prevKeys.set(k, v);
    }
    for (const btn of Object.keys(this._prevMouseButtons)) {
      this._prevMouseButtons[Number(btn)] = this._mouse.buttons[Number(btn)] ?? false;
    }
    this._mouse.dx = 0;
    this._mouse.dy = 0;
  }

  // ─── Key queries ─────────────────────────────────────────────────────────

  isKeyDown(code: string): boolean {
    return this._keys.get(code) === true;
  }

  isKeyPressed(code: string): boolean {
    return this._keys.get(code) === true && this._prevKeys.get(code) !== true;
  }

  isKeyReleased(code: string): boolean {
    return this._keys.get(code) !== true && this._prevKeys.get(code) === true;
  }

  // ─── Mouse queries ────────────────────────────────────────────────────────

  get mouseX(): number { return this._mouse.x; }
  get mouseY(): number { return this._mouse.y; }
  get mouseDX(): number { return this._mouse.dx; }
  get mouseDY(): number { return this._mouse.dy; }

  isMouseDown(button: number = 0): boolean {
    return this._mouse.buttons[button] === true;
  }

  isMousePressed(button: number = 0): boolean {
    return this._mouse.buttons[button] === true && this._prevMouseButtons[button] !== true;
  }

  // ─── Event handlers ───────────────────────────────────────────────────────

  private readonly _onKeyDown = (e: Event): void => {
    const ke = e as KeyboardEvent;
    this._keys.set(ke.code, true);
  };

  private readonly _onKeyUp = (e: Event): void => {
    const ke = e as KeyboardEvent;
    this._keys.set(ke.code, false);
  };

  private readonly _onMouseMove = (e: Event): void => {
    const me = e as MouseEvent;
    this._mouse.dx = me.movementX;
    this._mouse.dy = me.movementY;
    this._mouse.x = me.clientX;
    this._mouse.y = me.clientY;
  };

  private readonly _onMouseDown = (e: Event): void => {
    const me = e as MouseEvent;
    this._mouse.buttons[me.button] = true;
  };

  private readonly _onMouseUp = (e: Event): void => {
    const me = e as MouseEvent;
    this._mouse.buttons[me.button] = false;
  };
}

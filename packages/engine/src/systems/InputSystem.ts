export type KeyState = "up" | "down" | "pressed" | "released";

export interface MouseState {
  x: number;
  y: number;
  dx: number;
  dy: number;
  buttons: Record<number, boolean>;
}

export interface TouchPoint {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  /** Delta from previous frame. */
  readonly dx: number;
  readonly dy: number;
}

export class InputSystem {
  private readonly _keys: Map<string, boolean> = new Map();
  private readonly _prevKeys: Map<string, boolean> = new Map();
  private readonly _mouse: MouseState = {
    x: 0,
    y: 0,
    dx: 0,
    dy: 0,
    buttons: {},
  };
  private readonly _prevMouseButtons: Record<number, boolean> = {};

  // Touch
  private readonly _touches: Map<number, TouchPoint> = new Map();
  private readonly _prevTouches: Map<number, { x: number; y: number }> =
    new Map();
  private readonly _touchesStartedThisFrame: Set<number> = new Set();
  private readonly _touchesEndedThisFrame: Set<number> = new Set();

  private _boundTarget: EventTarget | null = null;

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  attach(target: EventTarget = window): void {
    this._boundTarget = target;
    target.addEventListener("keydown", this._onKeyDown);
    target.addEventListener("keyup", this._onKeyUp);
    target.addEventListener("mousemove", this._onMouseMove);
    target.addEventListener("mousedown", this._onMouseDown);
    target.addEventListener("mouseup", this._onMouseUp);
    target.addEventListener("touchstart", this._onTouchStart, {
      passive: true,
    });
    target.addEventListener("touchmove", this._onTouchMove, { passive: true });
    target.addEventListener("touchend", this._onTouchEnd, { passive: true });
    target.addEventListener("touchcancel", this._onTouchCancel, {
      passive: true,
    });
  }

  detach(): void {
    if (this._boundTarget === null) return;
    const t = this._boundTarget;
    t.removeEventListener("keydown", this._onKeyDown);
    t.removeEventListener("keyup", this._onKeyUp);
    t.removeEventListener("mousemove", this._onMouseMove);
    t.removeEventListener("mousedown", this._onMouseDown);
    t.removeEventListener("mouseup", this._onMouseUp);
    t.removeEventListener("touchstart", this._onTouchStart);
    t.removeEventListener("touchmove", this._onTouchMove);
    t.removeEventListener("touchend", this._onTouchEnd);
    t.removeEventListener("touchcancel", this._onTouchCancel);
    this._boundTarget = null;
  }

  /** Call at end of each frame to flush pressed/released states. */
  flush(): void {
    this._prevKeys.clear();
    for (const [k, v] of this._keys) this._prevKeys.set(k, v);

    for (const btn of Object.keys(this._prevMouseButtons)) {
      this._prevMouseButtons[Number(btn)] =
        this._mouse.buttons[Number(btn)] ?? false;
    }
    this._mouse.dx = 0;
    this._mouse.dy = 0;

    // Snapshot touch positions for delta next frame
    this._prevTouches.clear();
    for (const [id, tp] of this._touches) {
      this._prevTouches.set(id, { x: tp.x, y: tp.y });
    }
    this._touchesStartedThisFrame.clear();
    this._touchesEndedThisFrame.clear();
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

  get mouseX(): number {
    return this._mouse.x;
  }
  get mouseY(): number {
    return this._mouse.y;
  }
  get mouseDX(): number {
    return this._mouse.dx;
  }
  get mouseDY(): number {
    return this._mouse.dy;
  }

  isMouseDown(button = 0): boolean {
    return this._mouse.buttons[button] === true;
  }
  isMousePressed(button = 0): boolean {
    return (
      this._mouse.buttons[button] === true &&
      this._prevMouseButtons[button] !== true
    );
  }
  isMouseReleased(button = 0): boolean {
    return (
      this._mouse.buttons[button] !== true &&
      this._prevMouseButtons[button] === true
    );
  }

  // ─── Touch queries ────────────────────────────────────────────────────────

  /** Number of active touch points. */
  get touchCount(): number {
    return this._touches.size;
  }

  /** All currently active touch points. */
  get touches(): ReadonlyArray<TouchPoint> {
    return [...this._touches.values()];
  }

  /** Returns the active touch with the given pointer id, or `undefined` if no touch with that id is currently down. */
  getTouch(id: number): TouchPoint | undefined {
    return this._touches.get(id);
  }

  /** Primary touch (lowest id, or undefined if no touches). */
  get primaryTouch(): TouchPoint | undefined {
    let min: TouchPoint | undefined;
    for (const tp of this._touches.values()) {
      if (min === undefined || tp.id < min.id) min = tp;
    }
    return min;
  }

  /** True if a new touch started on this frame. */
  isTouchStarted(id?: number): boolean {
    return id === undefined
      ? this._touchesStartedThisFrame.size > 0
      : this._touchesStartedThisFrame.has(id);
  }

  /** True if a touch ended on this frame. */
  isTouchEnded(id?: number): boolean {
    return id === undefined
      ? this._touchesEndedThisFrame.size > 0
      : this._touchesEndedThisFrame.has(id);
  }

  // ─── Event handlers ───────────────────────────────────────────────────────

  private readonly _onKeyDown = (e: Event): void => {
    this._keys.set((e as KeyboardEvent).code, true);
  };
  private readonly _onKeyUp = (e: Event): void => {
    this._keys.set((e as KeyboardEvent).code, false);
  };

  private readonly _onMouseMove = (e: Event): void => {
    const me = e as MouseEvent;
    // Accumulate delta — multiple mousemove events can fire per frame at high poll rates.
    this._mouse.dx += me.movementX;
    this._mouse.dy += me.movementY;
    this._mouse.x = me.clientX;
    this._mouse.y = me.clientY;
  };

  private readonly _onMouseDown = (e: Event): void => {
    this._mouse.buttons[(e as MouseEvent).button] = true;
    this._prevMouseButtons[(e as MouseEvent).button] ??= false;
  };
  private readonly _onMouseUp = (e: Event): void => {
    this._mouse.buttons[(e as MouseEvent).button] = false;
  };

  private _updateTouches(te: TouchEvent, ended = false): void {
    for (let i = 0; i < te.changedTouches.length; i++) {
      const t = te.changedTouches.item(i);
      if (t === null) continue;
      if (ended) {
        this._touches.delete(t.identifier);
        this._touchesEndedThisFrame.add(t.identifier);
      } else {
        const prev = this._prevTouches.get(t.identifier);
        this._touches.set(t.identifier, {
          id: t.identifier,
          x: t.clientX,
          y: t.clientY,
          dx: prev !== undefined ? t.clientX - prev.x : 0,
          dy: prev !== undefined ? t.clientY - prev.y : 0,
        });
      }
    }
  }

  private readonly _onTouchStart = (e: Event): void => {
    const te = e as TouchEvent;
    for (let i = 0; i < te.changedTouches.length; i++) {
      const t = te.changedTouches.item(i);
      if (t !== null) this._touchesStartedThisFrame.add(t.identifier);
    }
    this._updateTouches(te);
  };
  private readonly _onTouchMove = (e: Event): void => {
    this._updateTouches(e as TouchEvent);
  };
  private readonly _onTouchEnd = (e: Event): void => {
    this._updateTouches(e as TouchEvent, true);
  };
  private readonly _onTouchCancel = (e: Event): void => {
    this._updateTouches(e as TouchEvent, true);
  };

  /** Alias for `detach()` — compatible with SystemManager teardown. */
  destroy(): void {
    this.detach();
  }
}

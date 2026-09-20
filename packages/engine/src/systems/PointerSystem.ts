// PointerSystem — unifies mouse, touch, and pen input into a single pointer
// stream using native Pointer Events, and layers a small dependency-free
// gesture recognizer (tap / long-press / swipe / pinch) on top of it.
//
// Rationale for Pointer Events over separate mouse/touch listeners: they fire
// uniformly for mouse, touch, and pen (see MDN Pointer Events spec), which is
// exactly the unified abstraction InputSystem's three separate code paths
// lack. No third-party gesture library is used — the gesture surface area
// here (four gestures, single-file) is small enough that a hand-rolled
// implementation is easier to test and keeps the engine free of new runtime
// dependencies, per the engine environment boundary in CLAUDE.md.

export interface PointerState {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly dx: number;
  readonly dy: number;
  readonly startX: number;
  readonly startY: number;
  readonly startTime: number;
  readonly pointerType: "mouse" | "touch" | "pen" | "unknown";
  readonly isPrimary: boolean;
  readonly buttons: number;
}

export type GestureType = "tap" | "longpress" | "swipe" | "pinch";

export interface TapGesture {
  type: "tap";
  x: number;
  y: number;
  pointerId: number;
}

export interface LongPressGesture {
  type: "longpress";
  x: number;
  y: number;
  pointerId: number;
}

export type SwipeDirection = "up" | "down" | "left" | "right";

export interface SwipeGesture {
  type: "swipe";
  x: number;
  y: number;
  pointerId: number;
  direction: SwipeDirection;
  velocity: number;
  distance: number;
}

export interface PinchGesture {
  type: "pinch";
  /** Center point between the two pointers, in the same coordinate space as pointer x/y. */
  x: number;
  y: number;
  /** Current distance between the two pointers. */
  distance: number;
  /** distance / startDistance — 1 means no change, >1 means spreading, <1 means pinching in. */
  scale: number;
  /** scale delta since the previous pinch event this gesture. */
  deltaScale: number;
}

export type Gesture = TapGesture | LongPressGesture | SwipeGesture | PinchGesture;

export interface WheelEventInfo {
  /** Horizontal scroll amount, sign/units depend on deltaMode. */
  deltaX: number;
  /** Vertical scroll amount, sign/units depend on deltaMode. */
  deltaY: number;
  /** 0 = pixel, 1 = line, 2 = page — WheelEvent.DOM_DELTA_* */
  deltaMode: number;
  /**
   * Heuristic classification of the input device. Trackpads typically
   * deliver small fractional pixel deltas on every frame of a gesture and
   * report `ctrlKey === true` for pinch-to-zoom gestures on Chrome/Firefox/
   * Safari (a synthesized signal, not literal Ctrl-key state). Mouse wheels
   * deliver large, discrete integer deltas per "click" of the wheel.
   */
  source: "trackpad" | "mouse-wheel";
  /** True when this event represents a pinch-to-zoom gesture on a trackpad. */
  isPinchZoom: boolean;
}

export type PointerDownHandler = (p: PointerState) => void;
export type PointerMoveHandler = (p: PointerState) => void;
export type PointerUpHandler = (p: PointerState) => void;
export type GestureHandler = (g: Gesture) => void;
export type WheelHandler = (w: WheelEventInfo) => void;

// ─── Tunables ────────────────────────────────────────────────────────────────

/** Max movement (px) for a down+up sequence to still count as a tap. */
const TAP_MAX_DISTANCE = 10;
/** Max duration (ms) for a down+up sequence to count as a tap. */
const TAP_MAX_DURATION = 300;
/** Time (ms) held with minimal movement before a long-press fires. */
const LONGPRESS_DURATION = 500;
/** Max movement (px) allowed during a long-press hold. */
const LONGPRESS_MAX_DISTANCE = 10;
/** Min velocity (px/ms) for a released pointer to count as a swipe. */
const SWIPE_MIN_VELOCITY = 0.3;
/** Min distance (px) for a released pointer to count as a swipe. */
const SWIPE_MIN_DISTANCE = 30;

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

interface InternalPointer {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  startX: number;
  startY: number;
  startTime: number;
  lastMoveTime: number;
  pointerType: "mouse" | "touch" | "pen" | "unknown";
  isPrimary: boolean;
  buttons: number;
  longPressFired: boolean;
  longPressTimer: ReturnType<typeof setTimeout> | null;
}

interface PinchTracker {
  ids: [number, number];
  startDistance: number;
  lastScale: number;
}

export class PointerSystem {
  private readonly _pointers: Map<number, InternalPointer> = new Map();
  private _boundTarget: EventTarget | null = null;
  private _pinch: PinchTracker | null = null;

  private readonly _downHandlers: PointerDownHandler[] = [];
  private readonly _moveHandlers: PointerMoveHandler[] = [];
  private readonly _upHandlers: PointerUpHandler[] = [];
  private readonly _gestureHandlers: GestureHandler[] = [];
  private readonly _wheelHandlers: WheelHandler[] = [];

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  /**
   * Attach native listeners. Guarded so it is a no-op outside a browser-like
   * environment (Node/Vitest) per the engine environment boundary — callers
   * may still feed synthetic events directly via the public dispatch methods
   * below for testing.
   */
  attach(target: EventTarget = typeof window !== "undefined" ? window : (undefined as unknown as EventTarget)): void {
    if (target === undefined || target === null) return;
    this._boundTarget = target;
    target.addEventListener("pointerdown", this._onPointerDown as EventListener);
    target.addEventListener("pointermove", this._onPointerMove as EventListener);
    target.addEventListener("pointerup", this._onPointerUp as EventListener);
    target.addEventListener("pointercancel", this._onPointerCancel as EventListener);
    target.addEventListener("wheel", this._onWheel as EventListener, {
      passive: true,
    });
  }

  detach(): void {
    if (this._boundTarget === null) return;
    const t = this._boundTarget;
    t.removeEventListener("pointerdown", this._onPointerDown as EventListener);
    t.removeEventListener("pointermove", this._onPointerMove as EventListener);
    t.removeEventListener("pointerup", this._onPointerUp as EventListener);
    t.removeEventListener("pointercancel", this._onPointerCancel as EventListener);
    t.removeEventListener("wheel", this._onWheel as EventListener);
    this._boundTarget = null;
    for (const p of this._pointers.values()) this._clearLongPressTimer(p);
    this._pointers.clear();
    this._pinch = null;
  }

  /** Alias for detach() — compatible with SystemManager teardown. */
  destroy(): void {
    this.detach();
  }

  // ─── Subscriptions ────────────────────────────────────────────────────────

  onPointerDown(handler: PointerDownHandler): () => void {
    this._downHandlers.push(handler);
    return () => this._remove(this._downHandlers, handler);
  }
  onPointerMove(handler: PointerMoveHandler): () => void {
    this._moveHandlers.push(handler);
    return () => this._remove(this._moveHandlers, handler);
  }
  onPointerUp(handler: PointerUpHandler): () => void {
    this._upHandlers.push(handler);
    return () => this._remove(this._upHandlers, handler);
  }
  onGesture(handler: GestureHandler): () => void {
    this._gestureHandlers.push(handler);
    return () => this._remove(this._gestureHandlers, handler);
  }
  onWheel(handler: WheelHandler): () => void {
    this._wheelHandlers.push(handler);
    return () => this._remove(this._wheelHandlers, handler);
  }

  private _remove<T>(arr: T[], item: T): void {
    const idx = arr.indexOf(item);
    if (idx !== -1) arr.splice(idx, 1);
  }

  // ─── Queries ──────────────────────────────────────────────────────────────

  get pointerCount(): number {
    return this._pointers.size;
  }

  get pointers(): ReadonlyArray<PointerState> {
    return [...this._pointers.values()].map((p) => this._toPublic(p));
  }

  getPointer(id: number): PointerState | undefined {
    const p = this._pointers.get(id);
    return p === undefined ? undefined : this._toPublic(p);
  }

  /** Primary pointer (mouse, or first touch), if any is active. */
  get primaryPointer(): PointerState | undefined {
    for (const p of this._pointers.values()) {
      if (p.isPrimary) return this._toPublic(p);
    }
    return undefined;
  }

  private _toPublic(p: InternalPointer): PointerState {
    return {
      id: p.id,
      x: p.x,
      y: p.y,
      dx: p.dx,
      dy: p.dy,
      startX: p.startX,
      startY: p.startY,
      startTime: p.startTime,
      pointerType: p.pointerType,
      isPrimary: p.isPrimary,
      buttons: p.buttons,
    };
  }

  // ─── Synthetic dispatch (used by native handlers and directly by tests) ────

  dispatchPointerDown(evt: {
    pointerId: number;
    clientX: number;
    clientY: number;
    pointerType?: string;
    isPrimary?: boolean;
    buttons?: number;
  }): void {
    const t = now();
    const pt = this._normalizePointerType(evt.pointerType);
    const p: InternalPointer = {
      id: evt.pointerId,
      x: evt.clientX,
      y: evt.clientY,
      dx: 0,
      dy: 0,
      startX: evt.clientX,
      startY: evt.clientY,
      startTime: t,
      lastMoveTime: t,
      pointerType: pt,
      isPrimary: evt.isPrimary ?? this._pointers.size === 0,
      buttons: evt.buttons ?? 1,
      longPressFired: false,
      longPressTimer: null,
    };
    this._pointers.set(p.id, p);
    this._scheduleLongPress(p);
    this._maybeStartPinch();
    for (const h of this._downHandlers) h(this._toPublic(p));
  }

  dispatchPointerMove(evt: {
    pointerId: number;
    clientX: number;
    clientY: number;
  }): void {
    const p = this._pointers.get(evt.pointerId);
    if (p === undefined) return;
    p.dx = evt.clientX - p.x;
    p.dy = evt.clientY - p.y;
    p.x = evt.clientX;
    p.y = evt.clientY;
    p.lastMoveTime = now();

    const moved = Math.hypot(p.x - p.startX, p.y - p.startY);
    if (moved > LONGPRESS_MAX_DISTANCE) this._clearLongPressTimer(p);

    this._updatePinch();
    for (const h of this._moveHandlers) h(this._toPublic(p));
  }

  dispatchPointerUp(evt: { pointerId: number; clientX: number; clientY: number }): void {
    const p = this._pointers.get(evt.pointerId);
    if (p === undefined) return;
    p.x = evt.clientX;
    p.y = evt.clientY;
    this._clearLongPressTimer(p);

    const t = now();
    const dist = Math.hypot(p.x - p.startX, p.y - p.startY);
    const duration = t - p.startTime;

    if (!p.longPressFired) {
      if (dist <= TAP_MAX_DISTANCE && duration <= TAP_MAX_DURATION) {
        this._emitGesture({ type: "tap", x: p.x, y: p.y, pointerId: p.id });
      } else if (duration > 0) {
        const velocity = dist / duration;
        if (velocity >= SWIPE_MIN_VELOCITY && dist >= SWIPE_MIN_DISTANCE) {
          this._emitGesture({
            type: "swipe",
            x: p.x,
            y: p.y,
            pointerId: p.id,
            direction: this._swipeDirection(p.x - p.startX, p.y - p.startY),
            velocity,
            distance: dist,
          });
        }
      }
    }

    this._pointers.delete(p.id);
    if (
      this._pinch !== null &&
      (this._pinch.ids[0] === p.id || this._pinch.ids[1] === p.id)
    ) {
      this._pinch = null;
    }
    for (const h of this._upHandlers) h(this._toPublic(p));
  }

  dispatchPointerCancel(evt: { pointerId: number }): void {
    const p = this._pointers.get(evt.pointerId);
    if (p === undefined) return;
    this._clearLongPressTimer(p);
    this._pointers.delete(p.id);
    if (
      this._pinch !== null &&
      (this._pinch.ids[0] === p.id || this._pinch.ids[1] === p.id)
    ) {
      this._pinch = null;
    }
  }

  dispatchWheel(evt: {
    deltaX: number;
    deltaY: number;
    deltaMode: number;
    ctrlKey?: boolean;
  }): void {
    // Heuristic: DOM_DELTA_PIXEL with small fractional-looking magnitude and
    // no ctrlKey is very likely a trackpad two-finger scroll; large integer
    // deltas or non-pixel deltaMode are very likely a physical mouse wheel.
    // ctrlKey === true on a wheel event is the synthesized pinch-to-zoom
    // signal most browsers emit for a trackpad pinch gesture.
    const isPinchZoom = evt.ctrlKey === true && evt.deltaMode === 0;
    const magnitude = Math.max(Math.abs(evt.deltaX), Math.abs(evt.deltaY));
    const looksFractional = !Number.isInteger(magnitude) || magnitude < 50;
    const source: WheelEventInfo["source"] =
      isPinchZoom || (evt.deltaMode === 0 && looksFractional)
        ? "trackpad"
        : "mouse-wheel";

    const info: WheelEventInfo = {
      deltaX: evt.deltaX,
      deltaY: evt.deltaY,
      deltaMode: evt.deltaMode,
      source,
      isPinchZoom,
    };
    for (const h of this._wheelHandlers) h(info);
  }

  // ─── Native event handlers (guarded — DOM types only referenced here) ─────

  private readonly _onPointerDown = (e: Event): void => {
    const pe = e as PointerEvent;
    this.dispatchPointerDown({
      pointerId: pe.pointerId,
      clientX: pe.clientX,
      clientY: pe.clientY,
      pointerType: pe.pointerType,
      isPrimary: pe.isPrimary,
      buttons: pe.buttons,
    });
  };

  private readonly _onPointerMove = (e: Event): void => {
    const pe = e as PointerEvent;
    this.dispatchPointerMove({
      pointerId: pe.pointerId,
      clientX: pe.clientX,
      clientY: pe.clientY,
    });
  };

  private readonly _onPointerUp = (e: Event): void => {
    const pe = e as PointerEvent;
    this.dispatchPointerUp({
      pointerId: pe.pointerId,
      clientX: pe.clientX,
      clientY: pe.clientY,
    });
  };

  private readonly _onPointerCancel = (e: Event): void => {
    const pe = e as PointerEvent;
    this.dispatchPointerCancel({ pointerId: pe.pointerId });
  };

  private readonly _onWheel = (e: Event): void => {
    const we = e as WheelEvent;
    this.dispatchWheel({
      deltaX: we.deltaX,
      deltaY: we.deltaY,
      deltaMode: we.deltaMode,
      ctrlKey: we.ctrlKey,
    });
  };

  // ─── Internal helpers ──────────────────────────────────────────────────────

  private _normalizePointerType(
    t: string | undefined,
  ): InternalPointer["pointerType"] {
    if (t === "mouse" || t === "touch" || t === "pen") return t;
    return "unknown";
  }

  private _swipeDirection(dx: number, dy: number): SwipeDirection {
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
    return dy >= 0 ? "down" : "up";
  }

  private _emitGesture(g: Gesture): void {
    for (const h of this._gestureHandlers) h(g);
  }

  private _scheduleLongPress(p: InternalPointer): void {
    if (typeof setTimeout === "undefined") return;
    p.longPressTimer = setTimeout(() => {
      const cur = this._pointers.get(p.id);
      if (cur === undefined) return;
      const moved = Math.hypot(cur.x - cur.startX, cur.y - cur.startY);
      if (moved <= LONGPRESS_MAX_DISTANCE) {
        cur.longPressFired = true;
        this._emitGesture({
          type: "longpress",
          x: cur.x,
          y: cur.y,
          pointerId: cur.id,
        });
      }
    }, LONGPRESS_DURATION);
  }

  private _clearLongPressTimer(p: InternalPointer): void {
    if (p.longPressTimer !== null) {
      clearTimeout(p.longPressTimer);
      p.longPressTimer = null;
    }
  }

  private _maybeStartPinch(): void {
    if (this._pointers.size !== 2) return;
    const [a, b] = [...this._pointers.values()];
    if (a === undefined || b === undefined) return;
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    this._pinch = { ids: [a.id, b.id], startDistance: distance, lastScale: 1 };
  }

  private _updatePinch(): void {
    if (this._pinch === null) return;
    const a = this._pointers.get(this._pinch.ids[0]);
    const b = this._pointers.get(this._pinch.ids[1]);
    if (a === undefined || b === undefined || this._pinch.startDistance === 0) return;
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    const scale = distance / this._pinch.startDistance;
    const deltaScale = scale - this._pinch.lastScale;
    this._pinch.lastScale = scale;
    this._emitGesture({
      type: "pinch",
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      distance,
      scale,
      deltaScale,
    });
  }
}

/** Minimum recommended interactive-widget dimension, per iOS Human Interface Guidelines. */
export const MIN_TOUCH_TARGET_SIZE = 44;

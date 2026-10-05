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
export type Gesture =
  TapGesture | LongPressGesture | SwipeGesture | PinchGesture;
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
export declare class PointerSystem {
  private readonly _pointers;
  private _boundTarget;
  private _pinch;
  /** Last `scale` seen from a Safari `GestureEvent`, for `deltaScale`. `null` when no gesture is in progress. */
  private _safariGestureLastScale;
  private readonly _downHandlers;
  private readonly _moveHandlers;
  private readonly _upHandlers;
  private readonly _gestureHandlers;
  private readonly _wheelHandlers;
  /**
   * Attach native listeners. Guarded so it is a no-op outside a browser-like
   * environment (Node/Vitest) per the engine environment boundary — callers
   * may still feed synthetic events directly via the public dispatch methods
   * below for testing.
   */
  attach(target?: EventTarget): void;
  detach(): void;
  /** Alias for detach() — compatible with SystemManager teardown. */
  destroy(): void;
  /**
   * Poll for time-based gestures. Call once per frame (like `GamepadSystem.
   * update()`); this is what fires `longpress` for a pointer held still past
   * `LONGPRESS_DURATION`. Uses polling rather than `setTimeout` so gesture
   * timing stays tied to the game loop instead of firing at an arbitrary
   * wall-clock moment mid-frame.
   */
  update(): void;
  onPointerDown(handler: PointerDownHandler): () => void;
  onPointerMove(handler: PointerMoveHandler): () => void;
  onPointerUp(handler: PointerUpHandler): () => void;
  onGesture(handler: GestureHandler): () => void;
  onWheel(handler: WheelHandler): () => void;
  private _remove;
  get pointerCount(): number;
  get pointers(): ReadonlyArray<PointerState>;
  getPointer(id: number): PointerState | undefined;
  /** Primary pointer (mouse, or first touch), if any is active. */
  get primaryPointer(): PointerState | undefined;
  private _toPublic;
  dispatchPointerDown(evt: {
    pointerId: number;
    clientX: number;
    clientY: number;
    pointerType?: string;
    isPrimary?: boolean;
    buttons?: number;
  }): void;
  dispatchPointerMove(evt: {
    pointerId: number;
    clientX: number;
    clientY: number;
  }): void;
  dispatchPointerUp(evt: {
    pointerId: number;
    clientX: number;
    clientY: number;
  }): void;
  dispatchPointerCancel(evt: { pointerId: number }): void;
  dispatchWheel(evt: {
    deltaX: number;
    deltaY: number;
    deltaMode: number;
    ctrlKey?: boolean;
  }): void;
  /**
   * Public, DOM-free entry point for Safari's `gesturestart` (see
   * `SafariGestureEvent`'s doc comment) — test-injectable the same way
   * `dispatchPointerDown`/`dispatchWheel` are, since jsdom (this repo's test
   * environment) doesn't implement WebKit's proprietary `GestureEvent`.
   */
  dispatchSafariGestureStart(): void;
  /** Public, DOM-free entry point for Safari's `gesturechange` — see `dispatchSafariGestureStart`. */
  dispatchSafariGestureChange(evt: {
    scale: number;
    clientX: number;
    clientY: number;
  }): void;
  /** Public, DOM-free entry point for Safari's `gestureend` — see `dispatchSafariGestureStart`. */
  dispatchSafariGestureEnd(): void;
  private readonly _onPointerDown;
  private readonly _onPointerMove;
  private readonly _onPointerUp;
  private readonly _onPointerCancel;
  private readonly _onWheel;
  /**
   * Safari's `GestureEvent` reports an absolute `scale` from the start of
   * the gesture, not a delta — start of gesture is scale 1 by definition.
   * Emits the same `PinchGesture` shape a real two-pointer touch pinch does
   * (`_updatePinch`), so game code handling `onGesture` for pinch doesn't
   * need a separate Safari-specific code path — this is purely a second
   * *signal* for the same gesture, not a different gesture type. Chrome/
   * Firefox/Edge never fire this event at all (they only ever fire
   * `ctrlKey`+`wheel`, handled by `dispatchWheel`), so there's no double-
   * counting risk between the two paths on any one browser. Logic lives in
   * the public `dispatchSafariGesture*` methods (test-injectable, jsdom has
   * no native `GestureEvent`); these handlers just unwrap the real event.
   */
  private readonly _onGestureStart;
  private readonly _onGestureChange;
  private readonly _onGestureEnd;
  private _normalizePointerType;
  private _swipeDirection;
  private _emitGesture;
  private _maybeStartPinch;
  private _updatePinch;
}
/** Minimum recommended interactive-widget dimension, per iOS Human Interface Guidelines. */
export declare const MIN_TOUCH_TARGET_SIZE = 44;

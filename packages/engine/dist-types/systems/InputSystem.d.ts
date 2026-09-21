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
export declare class InputSystem {
  private readonly _keys;
  private readonly _prevKeys;
  private readonly _mouse;
  private readonly _prevMouseButtons;
  private readonly _touches;
  private readonly _prevTouches;
  private readonly _touchesStartedThisFrame;
  private readonly _touchesEndedThisFrame;
  private _boundTarget;
  attach(target?: EventTarget): void;
  detach(): void;
  /** Call at end of each frame to flush pressed/released states. */
  flush(): void;
  isKeyDown(code: string): boolean;
  isKeyPressed(code: string): boolean;
  isKeyReleased(code: string): boolean;
  get mouseX(): number;
  get mouseY(): number;
  get mouseDX(): number;
  get mouseDY(): number;
  isMouseDown(button?: number): boolean;
  isMousePressed(button?: number): boolean;
  isMouseReleased(button?: number): boolean;
  /** Number of active touch points. */
  get touchCount(): number;
  /** All currently active touch points. */
  get touches(): ReadonlyArray<TouchPoint>;
  /** Returns the active touch with the given pointer id, or `undefined` if no touch with that id is currently down. */
  getTouch(id: number): TouchPoint | undefined;
  /** Primary touch (lowest id, or undefined if no touches). */
  get primaryTouch(): TouchPoint | undefined;
  /** True if a new touch started on this frame. */
  isTouchStarted(id?: number): boolean;
  /** True if a touch ended on this frame. */
  isTouchEnded(id?: number): boolean;
  private readonly _onKeyDown;
  private readonly _onKeyUp;
  private readonly _onMouseMove;
  private readonly _onMouseDown;
  private readonly _onMouseUp;
  private _updateTouches;
  private readonly _onTouchStart;
  private readonly _onTouchMove;
  private readonly _onTouchEnd;
  private readonly _onTouchCancel;
  /** Alias for `detach()` — compatible with SystemManager teardown. */
  destroy(): void;
}

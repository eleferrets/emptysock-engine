import { KeyboardLayout } from "./KeyboardLayout.js";
export type KeyState = "up" | "down" | "pressed" | "released";
export declare class InputSystem {
  private readonly _keys;
  private readonly _prevKeys;
  private _boundTarget;
  /**
   * Layout translation layer (host-injected provider plus keydown learning).
   * Key state itself stays keyed by physical `code`; this only answers
   * "which code types this character".
   */
  readonly layout: KeyboardLayout;
  /**
   * Keyboard-only. Mouse and touch used to be tracked here too, but had zero
   * real consumers outside this file (confirmed by a real-usage audit) and
   * duplicated what `PointerSystem` already does better — a real Pointer
   * Events-based unification of mouse/touch/pen plus tap/longpress/swipe/
   * pinch gesture recognition. `ecs/Input.ts`'s `InputManager` now wraps
   * `PointerSystem` directly for all of that; this class stays keyboard-only.
   */
  attach(target?: EventTarget): void;
  detach(): void;
  /** Call at end of each frame to flush pressed/released states. */
  flush(): void;
  isKeyDown(code: string): boolean;
  isKeyPressed(code: string): boolean;
  isKeyReleased(code: string): boolean;
  /**
   * A point-in-time copy of every key currently tracked. Used by
   * `ecs/Input.ts`'s `InputManager.snapshot()` to freeze keyboard state for
   * a frame — reading this once and caching
   * the result, rather than reading `isKeyDown` live, is what makes
   * "polled once, frozen for the frame" true even though this class itself
   * updates `_keys` continuously as DOM events arrive.
   */
  snapshotKeys(): ReadonlyMap<string, boolean>;
  /**
   * Test-only, non-DOM input injection. Drives the same internal state a
   * real `keydown`/`keyup` event would, without constructing a
   * `KeyboardEvent` or touching `window` — this is what keeps input testable
   * under a headless Node harness (CLAUDE.md's engine-environment-boundary
   * rule: no DOM dependency on this path).
   */
  simulateKeyDown(code: string, key?: string): void;
  /** See `simulateKeyDown`. */
  simulateKeyUp(code: string): void;
  private readonly _onKeyDown;
  private readonly _onKeyUp;
  /** Alias for `detach()` — compatible with SystemManager teardown. */
  destroy(): void;
}

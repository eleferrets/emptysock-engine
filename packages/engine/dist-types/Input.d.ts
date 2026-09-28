import { GamepadSystem } from "./systems/GamepadSystem.js";
import { InputSystem } from "./systems/InputSystem.js";
import {
  PointerSystem,
  type Gesture,
  type PointerState,
  type WheelEventInfo,
} from "./systems/PointerSystem.js";
import type { StorageAdapter } from "./systems/StorageAdapter.js";
/**
 * One physical source an action can bind to. Deliberately narrower than a
 * pointer/gesture binding — §15.3 only names keyboard/gamepad as the
 * action-mapped devices; pointer/touch/gesture input stays a raw-only
 * device via `input.pointers`/`input.gestures`/`input.wheelEvents` on the
 * escape hatch, since "was action X pressed" doesn't map cleanly onto "is a
 * pinch gesture active" the way it does onto a key or a gamepad button.
 */
export type Binding =
  | {
      readonly kind: "key";
      readonly code: string;
    }
  | {
      readonly kind: "gamepadButton";
      readonly index: number;
      readonly padIndex?: number;
    }
  | {
      readonly kind: "gamepadAxis";
      readonly axis: number;
      /** Threshold beyond which the axis counts as "active". Sign matters. */
      readonly threshold: number;
      readonly padIndex?: number;
    };
export type ActionMap = Record<string, readonly Binding[]>;
/** Read-only, per-frame-frozen keyboard state — ENGINE_DESIGN.md §15.3's raw escape hatch. */
export interface KeyboardSnapshot {
  isDown(code: string): boolean;
}
/** Read-only, per-frame-frozen state for one gamepad. */
export interface GamepadSnapshot {
  readonly connected: boolean;
  isButtonDown(index: number): boolean;
  axis(index: number): number;
}
/**
 * ENGINE_DESIGN.md §4 step 1 / §15.3 — the action-mapping input layer.
 *
 * `input.isDown("jump")` is the default and only thing most games touch;
 * `input.keyboard`/`input.gamepad(0)`/`input.pointers`/`input.gestures`/
 * `input.wheelEvents` stay available for games that need exact device-level
 * state. Both paths read off the same frozen snapshot, taken once per frame
 * by `Game.update()` calling `snapshot()` as step 1 — no `isDown`/
 * `keyboard`/`gamepad`/`pointers`/`gestures`/`wheelEvents` call changes
 * value mid-frame, no matter how many real input events the OS delivers
 * while that frame's `update()` is still running (see the "Input snapshot:
 * frozen by copy, not by timing" entry in CLAUDE.md).
 *
 * Raw device polling (`InputSystem`'s DOM listeners, `GamepadSystem`'s
 * `navigator.getGamepads()`, `PointerSystem`'s Pointer Events) is
 * unaffected by and independent of this class's environment: in Node/
 * headless (no `attach()` call, no `navigator.getGamepads`), every snapshot
 * is simply "nothing is down", matching CLAUDE.md's engine-environment-
 * boundary rule.
 */
export declare class InputManager {
  private readonly _input;
  private readonly _gamepadSystem;
  private readonly _pointerSystem;
  private _actions;
  /**
   * The `actions` map this instance was constructed with, kept verbatim so
   * `resetToDefaults()` has something real to restore to (ENGINE_DESIGN.md
   * §15.3's accessibility primitive #1: a player can always get back to the
   * shipped control scheme after rebinding).
   */
  private readonly _defaultActions;
  private _frozen;
  /** Gestures/wheel events accumulated since the last `snapshot()` call — see `FrozenInputState`'s doc comment. */
  private _pendingGestures;
  private _pendingWheelEvents;
  constructor(
    actions?: ActionMap,
    input?: InputSystem,
    gamepadSystem?: GamepadSystem,
    pointerSystem?: PointerSystem,
  );
  /**
   * Start listening to real device events. Never called by `Game` itself —
   * only the game's own browser/Tauri bootstrap code should call this,
   * since it touches `window` by default and must never run in the
   * headless/Node path (CLAUDE.md's engine-environment-boundary rule).
   */
  attach(target?: EventTarget): void;
  /** Stop listening to real device events. Safe to call even if never attached. */
  detach(): void;
  /** Replace the whole action map (rebind everything at once). */
  setActions(actions: ActionMap): void;
  /** Add or replace the bindings for a single action, leaving others untouched. */
  bindAction(action: string, bindings: readonly Binding[]): void;
  get actions(): ReadonlyArray<string>;
  getBindings(action: string): ReadonlyArray<Binding>;
  /**
   * Restore every action's bindings to the `actions` map this `InputManager`
   * was constructed with, discarding any `bindAction`/`setActions` rebinds
   * made since — the "reset to defaults" button a settings menu needs.
   */
  resetToDefaults(): void;
  /**
   * Persist the current action map through a `StorageAdapter` — the same
   * interface `SaveSystem` takes (CLAUDE.md's "SaveSystem storage backend
   * is an injected adapter" decision), not `SaveSystem` itself: an
   * `ActionMap` is a `Game`-level settings blob, not per-entity component
   * data, so `SaveSystem`'s `Scene`/`ComponentDef`-bound API is the wrong
   * shape for it. Pass the same adapter a game's `SaveSystem` uses (or any
   * other `StorageAdapter`) to keep control rebinds in the same storage
   * backend as save data, or a separate one for settings that should
   * survive a save being deleted.
   */
  saveBindings(adapter: StorageAdapter, key?: string): Promise<void>;
  /**
   * Load a previously `saveBindings()`-persisted action map. Returns `true`
   * if a saved map was found and applied, `false` (leaving the current
   * bindings untouched) if nothing was stored under `key` or the stored
   * value couldn't be parsed as an `ActionMap`.
   */
  loadBindings(adapter: StorageAdapter, key?: string): Promise<boolean>;
  /**
   * ENGINE_DESIGN.md §4 step 1. Copies the current live device state into
   * this frame's frozen snapshot. `Game.update()` calls this exactly once,
   * before anything else runs. Calling it again mid-frame (nothing in the
   * engine does) would advance the snapshot early — tests that want to
   * prove the freeze holds call `simulateKeyDown`/`simulateKeyUp` and then
   * assert `isDown` is unaffected *until* the next `snapshot()` call.
   */
  snapshot(): void;
  /** True if any binding for `action` is active in the current frozen snapshot. */
  isDown(action: string): boolean;
  /** Raw keyboard escape hatch (§15.3) — reads the frozen snapshot, not live state. */
  get keyboard(): KeyboardSnapshot;
  /** Raw gamepad escape hatch (§15.3) — reads the frozen snapshot, not live state. */
  gamepad(index: number): GamepadSnapshot;
  /**
   * Raw pointer escape hatch (§15.3) — unified mouse/touch/pen state, one
   * entry per currently-down pointer, reading the frozen snapshot, not
   * live state.
   */
  get pointers(): ReadonlyArray<PointerState>;
  /**
   * Tap/longpress/swipe/pinch gestures that occurred since the previous
   * `snapshot()` call (this frame's gestures) — see `FrozenInputState`'s
   * doc comment on why this is a per-frame list, not continuous state.
   */
  get gestures(): ReadonlyArray<Gesture>;
  /**
   * Raw wheel/trackpad events since the previous `snapshot()` call,
   * including `isPinchZoom`-flagged trackpad-pinch-via-`ctrlKey` events —
   * see `PointerSystem`'s `dispatchWheel` doc comment for the trackpad vs.
   * mouse-wheel classification heuristic.
   */
  get wheelEvents(): ReadonlyArray<WheelEventInfo>;
  /**
   * Test-only, non-DOM key injection (see `InputSystem.simulateKeyDown`).
   * Affects the *live* device state only — it has no effect on `isDown`/
   * `keyboard`/etc. until the next `snapshot()` call, which is the whole
   * point: it is how the freeze-for-the-frame behavior gets exercised by a
   * test without needing a real `KeyboardEvent`.
   */
  simulateKeyDown(code: string): void;
  /** See `simulateKeyDown`. */
  simulateKeyUp(code: string): void;
  private _isBindingActive;
}
//# sourceMappingURL=Input.d.ts.map

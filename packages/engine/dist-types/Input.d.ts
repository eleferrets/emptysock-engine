import { GamepadSystem } from "./systems/GamepadSystem.js";
import { type KeyboardLayout } from "./systems/KeyboardLayout.js";
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
      /** Physical `KeyboardEvent.code`. Always present; the fallback when `char` cannot be resolved. */
      readonly code: string;
      /**
       * Optional: "the key that types this letter". When set and the active
       * layout knows a key for it, that key is read instead of `code`
       * (`layout.codeForChar(char) ?? code`). Letters only. Absent means a
       * purely physical binding, which is what old saves and authored
       * defaults are.
       */
      readonly char?: string;
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
  /** Physical: is the key with this `KeyboardEvent.code` down. */
  isDown(code: string): boolean;
  /** Layout-aware: is the key that types this letter on the active layout down. False when the layout has no such key. */
  isCharDown(ch: string): boolean;
}
/** Read-only, per-frame-frozen state for one gamepad. */
export interface GamepadSnapshot {
  readonly connected: boolean;
  isButtonDown(index: number): boolean;
  axis(index: number): number;
}
/** Default `StorageAdapter` key for `saveBindings`/`loadBindings`. */
export declare const INPUT_BINDINGS_STORAGE_KEY = "emptysock_input_bindings";
export type CaptureKind = "key" | "gamepadButton" | "gamepadAxis";
export interface CaptureOptions {
  /** Which input kinds may be captured. Default: all. */
  kinds?: readonly CaptureKind[];
  /** Resolve `null` if nothing is captured within this many ms. Default: none. */
  timeoutMs?: number;
  /** Key codes that cancel the capture (resolve `null`). Default `["Escape"]`. */
  cancelCodes?: readonly string[];
  /** `"physical"` (default) records `code` only; `"char"` also records `char` for letter keys the layout knows. */
  mode?: "physical" | "char";
  /** Resolve `null` when aborted. */
  signal?: AbortSignal;
  /** Accept a lone Shift/Ctrl/Alt/Meta press. Default false. */
  allowModifiers?: boolean;
  /** Axis magnitude that counts as a press. Default 0.5. */
  axisThreshold?: number;
}
export interface CaptureResult {
  readonly binding: Binding;
  readonly label: string;
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
  /** Per-action edge tracking, advanced once per `snapshot()`. */
  private readonly _prevActive;
  private readonly _pressed;
  private readonly _released;
  private _capture;
  /** Inputs swallowed by a capture, hidden until physically released. Ids: `k:<code>`, `b:<pad>:<idx>`, `a:<pad>:<axis>:<+|->`. */
  private readonly _suppressed;
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
  /** Alias of `bindAction` — replace an action's bindings outright (the settings-menu "rebind" case). */
  rebind(action: string, bindings: readonly Binding[]): void;
  /** Append one binding to an action (duplicates ignored). */
  addBinding(action: string, binding: Binding): void;
  /** Remove one binding from an action, or the whole action when `binding` is omitted. */
  unbind(action: string, binding?: Binding): void;
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
  private _updateEdges;
  /** True only on the frame (snapshot) the action went from inactive to active. */
  wasPressed(action: string): boolean;
  /** True only on the frame (snapshot) the action went from active to inactive. */
  wasReleased(action: string): boolean;
  /** True if any binding for `action` is active in the current frozen snapshot. */
  isDown(action: string): boolean;
  /** The keyboard layout translation layer. Hosts call `layout.setProvider(...)` at bootstrap; the engine itself never touches `navigator`. */
  get layout(): KeyboardLayout;
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
  simulateKeyDown(code: string, key?: string): void;
  /** See `simulateKeyDown`. */
  simulateKeyUp(code: string): void;
  /**
   * Wait for the next new input and resolve with a `Binding` for it, or
   * `null` on cancel (Escape by default), timeout or abort. Arms on the
   * next `snapshot()`; anything already held at that moment must be released
   * first. The captured press is swallowed (reads as up) until released so
   * it does not also trigger the game action. Only one capture is pending
   * at a time: starting a new one cancels the previous with `null`.
   */
  captureNext(opts?: CaptureOptions): Promise<CaptureResult | null>;
  /** `captureNext`, then `rebind` (or `addBinding` with `add: true`) the action to the result. Resolves `null` if cancelled. */
  rebindByCapture(
    action: string,
    opts?: CaptureOptions & {
      add?: boolean;
    },
  ): Promise<CaptureResult | null>;
  private _applySuppressionAndCapture;
  private _swallow;
  private _keyBinding;
  private _rawGamepadIdDown;
  private _resolveKeyCode;
  /** Human label for a binding ("A", "Q", "Space", "Pad A", "Axis 1+"). Key labels follow the active layout. */
  bindingLabel(b: Binding): string;
  private _isBindingActive;
}

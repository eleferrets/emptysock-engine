import { GamepadSystem, type GamepadState } from "./systems/GamepadSystem.js";
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
  | { readonly kind: "key"; readonly code: string }
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

const DISCONNECTED_GAMEPAD: GamepadSnapshot = {
  connected: false,
  isButtonDown: () => false,
  axis: () => 0,
};

interface FrozenInputState {
  readonly keys: ReadonlyMap<string, boolean>;
  readonly gamepads: ReadonlyMap<number, GamepadState>;
  readonly pointers: ReadonlyArray<PointerState>;
  /**
   * Gestures/wheel events are momentary, not continuous state like a key or
   * gamepad axis — there is no "currently active" pinch the way there's a
   * "currently held" key. What gets frozen each frame is the list of
   * gesture/wheel events that occurred *since the previous snapshot()*,
   * buffered by listeners registered once in the constructor. A gesture
   * that fires between two `snapshot()` calls is never silently dropped or
   * silently merged into the next frame's list — it belongs to exactly the
   * frame whose `snapshot()` call collects it.
   */
  readonly gestures: ReadonlyArray<Gesture>;
  readonly wheelEvents: ReadonlyArray<WheelEventInfo>;
}

const EMPTY_FROZEN_STATE: FrozenInputState = {
  keys: new Map(),
  gamepads: new Map(),
  pointers: [],
  gestures: [],
  wheelEvents: [],
};

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
export class InputManager {
  private readonly _input: InputSystem;
  private readonly _gamepadSystem: GamepadSystem;
  private readonly _pointerSystem: PointerSystem;
  private _actions: ActionMap;
  /**
   * The `actions` map this instance was constructed with, kept verbatim so
   * `resetToDefaults()` has something real to restore to — the classic
   * `InputBindings.resetToDefaults()`'s exact behaviour (ENGINE_DESIGN.md
   * §15.3's accessibility primitive #1: a player can always get back to the
   * shipped control scheme after rebinding).
   */
  private readonly _defaultActions: ActionMap;
  private _frozen: FrozenInputState = EMPTY_FROZEN_STATE;
  /** Gestures/wheel events accumulated since the last `snapshot()` call — see `FrozenInputState`'s doc comment. */
  private _pendingGestures: Gesture[] = [];
  private _pendingWheelEvents: WheelEventInfo[] = [];

  constructor(
    actions: ActionMap = {},
    input: InputSystem = new InputSystem(),
    gamepadSystem: GamepadSystem = new GamepadSystem(),
    pointerSystem: PointerSystem = new PointerSystem(),
  ) {
    this._actions = actions;
    this._defaultActions = actions;
    this._input = input;
    this._gamepadSystem = gamepadSystem;
    this._pointerSystem = pointerSystem;
    this._pointerSystem.onGesture((g) => this._pendingGestures.push(g));
    this._pointerSystem.onWheel((w) => this._pendingWheelEvents.push(w));
  }

  /**
   * Start listening to real device events. Never called by `Game` itself —
   * only the game's own browser/Tauri bootstrap code should call this,
   * since it touches `window` by default and must never run in the
   * headless/Node path (CLAUDE.md's engine-environment-boundary rule).
   */
  attach(target?: EventTarget): void {
    if (target === undefined) {
      this._input.attach();
      this._pointerSystem.attach();
    } else {
      this._input.attach(target);
      this._pointerSystem.attach(target);
    }
  }

  /** Stop listening to real device events. Safe to call even if never attached. */
  detach(): void {
    this._input.detach();
    this._pointerSystem.detach();
  }

  /** Replace the whole action map (rebind everything at once). */
  setActions(actions: ActionMap): void {
    this._actions = actions;
  }

  /** Add or replace the bindings for a single action, leaving others untouched. */
  bindAction(action: string, bindings: readonly Binding[]): void {
    this._actions = { ...this._actions, [action]: [...bindings] };
  }

  get actions(): ReadonlyArray<string> {
    return Object.keys(this._actions);
  }

  getBindings(action: string): ReadonlyArray<Binding> {
    return this._actions[action] ?? [];
  }

  /**
   * Restore every action's bindings to the `actions` map this `InputManager`
   * was constructed with, discarding any `bindAction`/`setActions` rebinds
   * made since — the "reset to defaults" button a settings menu needs.
   */
  resetToDefaults(): void {
    this._actions = this._defaultActions;
  }

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
  async saveBindings(
    adapter: StorageAdapter,
    key = "emptysock_input_bindings",
  ): Promise<void> {
    await adapter.set(key, JSON.stringify(this._actions));
  }

  /**
   * Load a previously `saveBindings()`-persisted action map. Returns `true`
   * if a saved map was found and applied, `false` (leaving the current
   * bindings untouched) if nothing was stored under `key` or the stored
   * value couldn't be parsed as an `ActionMap`.
   */
  async loadBindings(
    adapter: StorageAdapter,
    key = "emptysock_input_bindings",
  ): Promise<boolean> {
    const raw = await adapter.get(key);
    if (raw === null) return false;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed === null || typeof parsed !== "object") return false;
      this._actions = parsed as ActionMap;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * ENGINE_DESIGN.md §4 step 1. Copies the current live device state into
   * this frame's frozen snapshot. `Game.update()` calls this exactly once,
   * before anything else runs. Calling it again mid-frame (nothing in the
   * engine does) would advance the snapshot early — tests that want to
   * prove the freeze holds call `simulateKeyDown`/`simulateKeyUp` and then
   * assert `isDown` is unaffected *until* the next `snapshot()` call.
   */
  snapshot(): void {
    this._gamepadSystem.update();
    const gamepads = new Map<number, GamepadState>();
    for (let i = 0; i < 4; i++) {
      const state = this._gamepadSystem.getState(i);
      if (state !== null) gamepads.set(i, state);
    }
    this._frozen = {
      keys: this._input.snapshotKeys(),
      gamepads,
      pointers: this._pointerSystem.pointers,
      gestures: this._pendingGestures,
      wheelEvents: this._pendingWheelEvents,
    };
    // Advance press/release edge tracking for the *next* snapshot, now that
    // this frame's edges have already been captured into `_frozen`/above.
    this._input.flush();
    // Start a fresh buffer for the *next* frame's gestures/wheel events —
    // this frame's list is already captured into `_frozen` above.
    this._pendingGestures = [];
    this._pendingWheelEvents = [];
  }

  /** True if any binding for `action` is active in the current frozen snapshot. */
  isDown(action: string): boolean {
    const bindings = this._actions[action];
    if (bindings === undefined) return false;
    return bindings.some((b) => this._isBindingActive(b));
  }

  /** Raw keyboard escape hatch (§15.3) — reads the frozen snapshot, not live state. */
  get keyboard(): KeyboardSnapshot {
    const keys = this._frozen.keys;
    return { isDown: (code: string) => keys.get(code) === true };
  }

  /** Raw gamepad escape hatch (§15.3) — reads the frozen snapshot, not live state. */
  gamepad(index: number): GamepadSnapshot {
    const state = this._frozen.gamepads.get(index);
    if (state === undefined) return DISCONNECTED_GAMEPAD;
    return {
      connected: state.connected,
      isButtonDown: (i: number) => state.buttons[i] === true,
      axis: (i: number) => state.axes[i] ?? 0,
    };
  }

  /**
   * Raw pointer escape hatch (§15.3) — unified mouse/touch/pen state, one
   * entry per currently-down pointer, reading the frozen snapshot, not
   * live state.
   */
  get pointers(): ReadonlyArray<PointerState> {
    return this._frozen.pointers;
  }

  /**
   * Tap/longpress/swipe/pinch gestures that occurred since the previous
   * `snapshot()` call (this frame's gestures) — see `FrozenInputState`'s
   * doc comment on why this is a per-frame list, not continuous state.
   */
  get gestures(): ReadonlyArray<Gesture> {
    return this._frozen.gestures;
  }

  /**
   * Raw wheel/trackpad events since the previous `snapshot()` call,
   * including `isPinchZoom`-flagged trackpad-pinch-via-`ctrlKey` events —
   * see `PointerSystem`'s `dispatchWheel` doc comment for the trackpad vs.
   * mouse-wheel classification heuristic.
   */
  get wheelEvents(): ReadonlyArray<WheelEventInfo> {
    return this._frozen.wheelEvents;
  }

  /**
   * Test-only, non-DOM key injection (see `InputSystem.simulateKeyDown`).
   * Affects the *live* device state only — it has no effect on `isDown`/
   * `keyboard`/etc. until the next `snapshot()` call, which is the whole
   * point: it is how the freeze-for-the-frame behavior gets exercised by a
   * test without needing a real `KeyboardEvent`.
   */
  simulateKeyDown(code: string): void {
    this._input.simulateKeyDown(code);
  }

  /** See `simulateKeyDown`. */
  simulateKeyUp(code: string): void {
    this._input.simulateKeyUp(code);
  }

  private _isBindingActive(b: Binding): boolean {
    switch (b.kind) {
      case "key":
        return this._frozen.keys.get(b.code) === true;
      case "gamepadButton": {
        const state = this._frozen.gamepads.get(b.padIndex ?? 0);
        return state?.buttons[b.index] === true;
      }
      case "gamepadAxis": {
        const state = this._frozen.gamepads.get(b.padIndex ?? 0);
        const v = state?.axes[b.axis];
        if (v === undefined) return false;
        return b.threshold >= 0 ? v >= b.threshold : v <= b.threshold;
      }
    }
  }
}

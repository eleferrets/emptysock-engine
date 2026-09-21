import { GamepadSystem, type GamepadState } from "../systems/GamepadSystem.js";
import { InputSystem, type TouchPoint } from "../systems/InputSystem.js";

/**
 * One physical source an action can bind to. Deliberately a subset of v1's
 * `InputBindings.Binding` (no mouse-button binding — §15.3 only names
 * keyboard/gamepad/touch as the action-mapped devices; mouse stays a raw-only
 * device via `input.mouse` equivalents on the escape hatch, same as v1).
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
  readonly touches: ReadonlyArray<TouchPoint>;
}

const EMPTY_FROZEN_STATE: FrozenInputState = {
  keys: new Map(),
  gamepads: new Map(),
  touches: [],
};

/**
 * ENGINE_DESIGN.md §4 step 1 / §15.3 — the action-mapping input layer.
 *
 * `input.isDown("jump")` is the default and only thing most games touch;
 * `input.keyboard`/`input.gamepad(0)`/`input.touches` stay available for
 * games that need exact device-level state. Both paths read off the same
 * frozen snapshot, taken once per frame by `Game.update()` calling
 * `snapshot()` as step 1 — no `isDown`/`keyboard`/`gamepad`/`touches` call
 * changes value mid-frame, no matter how many real input events the OS
 * delivers while that frame's `update()` is still running (see the
 * "Input snapshot: frozen by copy, not by timing" entry in CLAUDE.md).
 *
 * Raw device polling (`InputSystem`'s DOM listeners, `GamepadSystem`'s
 * `navigator.getGamepads()`) is unaffected by and independent of this
 * class's environment: in Node/headless (no `attach()` call, no
 * `navigator.getGamepads`), every snapshot is simply "nothing is down",
 * matching CLAUDE.md's engine-environment-boundary rule.
 */
export class InputManager {
  private readonly _input: InputSystem;
  private readonly _gamepadSystem: GamepadSystem;
  private _actions: ActionMap;
  private _frozen: FrozenInputState = EMPTY_FROZEN_STATE;

  constructor(
    actions: ActionMap = {},
    input: InputSystem = new InputSystem(),
    gamepadSystem: GamepadSystem = new GamepadSystem(),
  ) {
    this._actions = actions;
    this._input = input;
    this._gamepadSystem = gamepadSystem;
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
    } else {
      this._input.attach(target);
    }
  }

  /** Stop listening to real device events. Safe to call even if never attached. */
  detach(): void {
    this._input.detach();
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
      touches: this._input.touches,
    };
    // Advance press/release edge tracking for the *next* snapshot, now that
    // this frame's edges have already been captured into `_frozen`/above.
    this._input.flush();
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

  /** Raw touch escape hatch (§15.3) — reads the frozen snapshot, not live state. */
  get touches(): ReadonlyArray<TouchPoint> {
    return this._frozen.touches;
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

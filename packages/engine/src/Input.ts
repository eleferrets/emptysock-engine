import { GamepadSystem, type GamepadState } from "./systems/GamepadSystem.js";
import { isLetterChar, type KeyboardLayout } from "./systems/KeyboardLayout.js";
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

/** Read-only, per-frame-frozen keyboard state — the engine design notes's raw escape hatch. */
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
export const INPUT_BINDINGS_STORAGE_KEY = "emptysock_input_bindings";

function sameBinding(a: Binding, b: Binding): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case "key":
      return a.code === (b as typeof a).code && a.char === (b as typeof a).char;
    case "gamepadButton": {
      const o = b as typeof a;
      return a.index === o.index && (a.padIndex ?? 0) === (o.padIndex ?? 0);
    }
    case "gamepadAxis": {
      const o = b as typeof a;
      return (
        a.axis === o.axis &&
        a.threshold === o.threshold &&
        (a.padIndex ?? 0) === (o.padIndex ?? 0)
      );
    }
  }
}

function isBinding(v: unknown): v is Binding {
  if (typeof v !== "object" || v === null) return false;
  const o = v as {
    padIndex?: unknown;
    kind?: unknown;
    code?: unknown;
    char?: unknown;
    index?: unknown;
    axis?: unknown;
    threshold?: unknown;
  };
  const padOk = o.padIndex === undefined || typeof o.padIndex === "number";
  if (!padOk) return false;
  switch (o.kind) {
    case "key":
      return (
        typeof o.code === "string" &&
        (o.char === undefined || typeof o.char === "string")
      );
    case "gamepadButton":
      return typeof o.index === "number";
    case "gamepadAxis":
      return typeof o.axis === "number" && typeof o.threshold === "number";
    default:
      return false;
  }
}

function parseActionMap(v: unknown): ActionMap | null {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const out: Record<string, readonly Binding[]> = {};
  for (const [action, list] of Object.entries(v)) {
    if (!Array.isArray(list) || !list.every(isBinding)) return null;
    out[action] = list;
  }
  return out;
}

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

interface PendingCapture {
  readonly opts: CaptureOptions;
  readonly finish: (r: CaptureResult | null) => void;
  armed: boolean;
  /** Ids held at arm time; must be released before they can be captured. */
  readonly ignored: Set<string>;
}

const MODIFIER_CODES: ReadonlySet<string> = new Set([
  "ShiftLeft",
  "ShiftRight",
  "ControlLeft",
  "ControlRight",
  "AltLeft",
  "AltRight",
  "MetaLeft",
  "MetaRight",
]);

const axisSuppressId = (pad: number, axis: number, positive: boolean): string =>
  `a:${pad}:${axis}:${positive ? "+" : "-"}`;

/** W3C Standard Gamepad button names, for `bindingLabel`. */
const PAD_BUTTON_NAMES: readonly string[] = [
  "A",
  "B",
  "X",
  "Y",
  "LB",
  "RB",
  "LT",
  "RT",
  "Back",
  "Start",
  "L3",
  "R3",
  "Up",
  "Down",
  "Left",
  "Right",
  "Home",
];

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
 * the engine design notes step 1 / §15.3 — the action-mapping input layer.
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
   * `resetToDefaults()` has something real to restore to (the engine design notes
   * §15.3's accessibility primitive #1: a player can always get back to the
   * shipped control scheme after rebinding).
   */
  private readonly _defaultActions: ActionMap;
  private _frozen: FrozenInputState = EMPTY_FROZEN_STATE;
  /** Gestures/wheel events accumulated since the last `snapshot()` call — see `FrozenInputState`'s doc comment. */
  private _pendingGestures: Gesture[] = [];
  private _pendingWheelEvents: WheelEventInfo[] = [];
  /** Per-action edge tracking, advanced once per `snapshot()`. */
  private readonly _prevActive = new Map<string, boolean>();
  private readonly _pressed = new Set<string>();
  private readonly _released = new Set<string>();
  private _capture: PendingCapture | null = null;
  /** Inputs swallowed by a capture, hidden until physically released. Ids: `k:<code>`, `b:<pad>:<idx>`, `a:<pad>:<axis>:<+|->`. */
  private readonly _suppressed = new Set<string>();

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

  /** Alias of `bindAction` — replace an action's bindings outright (the settings-menu "rebind" case). */
  rebind(action: string, bindings: readonly Binding[]): void {
    this.bindAction(action, bindings);
  }

  /** Append one binding to an action (duplicates ignored). */
  addBinding(action: string, binding: Binding): void {
    const list = this._actions[action] ?? [];
    if (list.some((b) => sameBinding(b, binding))) return;
    this._actions = { ...this._actions, [action]: [...list, binding] };
  }

  /** Remove one binding from an action, or the whole action when `binding` is omitted. */
  unbind(action: string, binding?: Binding): void {
    if (binding === undefined) {
      const { [action]: _removed, ...rest } = this._actions;
      void _removed;
      this._actions = rest;
      this._prevActive.delete(action);
      return;
    }
    const list = this._actions[action];
    if (list === undefined) return;
    this._actions = {
      ...this._actions,
      [action]: list.filter((b) => !sameBinding(b, binding)),
    };
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
    this._prevActive.clear();
    this._pressed.clear();
    this._released.clear();
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
    key = INPUT_BINDINGS_STORAGE_KEY,
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
    key = INPUT_BINDINGS_STORAGE_KEY,
  ): Promise<boolean> {
    let raw: string | null;
    try {
      raw = await adapter.get(key);
    } catch {
      return false;
    }
    if (raw === null) return false;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return false;
    }
    const map = parseActionMap(parsed);
    if (map === null) return false;
    this._actions = map;
    this._prevActive.clear();
    this._pressed.clear();
    this._released.clear();
    return true;
  }

  /**
   * the engine design notes step 1. Copies the current live device state into
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
    // `snapshotKeys()` returns a fresh copy, so capture/suppression may edit it.
    const keys = this._input.snapshotKeys() as Map<string, boolean>;
    this._applySuppressionAndCapture(keys, gamepads);
    this._frozen = {
      keys,
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
    this._updateEdges();
  }

  private _updateEdges(): void {
    this._pressed.clear();
    this._released.clear();
    for (const action of Object.keys(this._actions)) {
      const now = this.isDown(action);
      const was = this._prevActive.get(action) === true;
      if (now && !was) this._pressed.add(action);
      if (!now && was) this._released.add(action);
      this._prevActive.set(action, now);
    }
  }

  /** True only on the frame (snapshot) the action went from inactive to active. */
  wasPressed(action: string): boolean {
    return this._pressed.has(action);
  }

  /** True only on the frame (snapshot) the action went from active to inactive. */
  wasReleased(action: string): boolean {
    return this._released.has(action);
  }

  /** True if any binding for `action` is active in the current frozen snapshot. */
  isDown(action: string): boolean {
    const bindings = this._actions[action];
    if (bindings === undefined) return false;
    return bindings.some((b) => this._isBindingActive(b));
  }

  /** The keyboard layout translation layer. Hosts call `layout.setProvider(...)` at bootstrap; the engine itself never touches `navigator`. */
  get layout(): KeyboardLayout {
    return this._input.layout;
  }

  /** Raw keyboard escape hatch (§15.3) — reads the frozen snapshot, not live state. */
  get keyboard(): KeyboardSnapshot {
    const keys = this._frozen.keys;
    const layout = this._input.layout;
    return {
      isDown: (code: string) => keys.get(code) === true,
      isCharDown: (ch: string) => {
        const code = layout.codeForChar(ch);
        return code !== undefined && keys.get(code) === true;
      },
    };
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
  simulateKeyDown(code: string, key?: string): void {
    this._input.simulateKeyDown(code, key);
  }

  /** See `simulateKeyDown`. */
  simulateKeyUp(code: string): void {
    this._input.simulateKeyUp(code);
  }

  /**
   * Wait for the next new input and resolve with a `Binding` for it, or
   * `null` on cancel (Escape by default), timeout or abort. Arms on the
   * next `snapshot()`; anything already held at that moment must be released
   * first. The captured press is swallowed (reads as up) until released so
   * it does not also trigger the game action. Only one capture is pending
   * at a time: starting a new one cancels the previous with `null`.
   */
  captureNext(opts: CaptureOptions = {}): Promise<CaptureResult | null> {
    this._capture?.finish(null);
    return new Promise<CaptureResult | null>((resolve) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const onAbort = (): void => pending.finish(null);
      const pending: PendingCapture = {
        opts,
        armed: false,
        ignored: new Set(),
        finish: (r) => {
          if (this._capture === pending) this._capture = null;
          if (timer !== undefined) clearTimeout(timer);
          opts.signal?.removeEventListener("abort", onAbort);
          resolve(r);
        },
      };
      if (opts.signal?.aborted === true) {
        resolve(null);
        return;
      }
      opts.signal?.addEventListener("abort", onAbort);
      if (opts.timeoutMs !== undefined) {
        timer = setTimeout(() => pending.finish(null), opts.timeoutMs);
      }
      this._capture = pending;
    });
  }

  /** `captureNext`, then `rebind` (or `addBinding` with `add: true`) the action to the result. Resolves `null` if cancelled. */
  async rebindByCapture(
    action: string,
    opts: CaptureOptions & { add?: boolean } = {},
  ): Promise<CaptureResult | null> {
    const result = await this.captureNext(opts);
    if (result === null) return null;
    if (opts.add === true) this.addBinding(action, result.binding);
    else this.rebind(action, [result.binding]);
    return result;
  }

  private _applySuppressionAndCapture(
    keys: Map<string, boolean>,
    gamepads: ReadonlyMap<number, GamepadState>,
  ): void {
    // Drop suppression for inputs that were physically released; hide the rest.
    for (const id of [...this._suppressed]) {
      if (id.startsWith("k:")) {
        const code = id.slice(2);
        if (keys.get(code) === true) keys.set(code, false);
        else this._suppressed.delete(id);
      } else if (!this._rawGamepadIdDown(id, gamepads)) {
        this._suppressed.delete(id);
      }
    }
    const cap = this._capture;
    if (cap === null) return;
    const opts = cap.opts;
    const kinds = opts.kinds ?? ["key", "gamepadButton", "gamepadAxis"];
    const cancel = opts.cancelCodes ?? ["Escape"];
    const th = Math.abs(opts.axisThreshold ?? 0.5);

    // Enumerate every input currently down, in a stable order.
    const down: Array<{ id: string; make: () => Binding; code?: string }> = [];
    // Suppressed keys were hidden above, so they never appear here.
    for (const [code, isDown] of keys) {
      if (!isDown) continue;
      down.push({
        id: `k:${code}`,
        code,
        make: () => this._keyBinding(code, opts.mode === "char"),
      });
    }
    for (const [pad, st] of gamepads) {
      st.buttons.forEach((b, index) => {
        if (b !== true) return;
        down.push({
          id: `b:${pad}:${index}`,
          make: () => ({
            kind: "gamepadButton",
            index,
            ...(pad !== 0 ? { padIndex: pad } : {}),
          }),
        });
      });
      st.axes.forEach((v, axis) => {
        if (Math.abs(v) < th) return;
        const positive = v > 0;
        down.push({
          id: axisSuppressId(pad, axis, positive),
          make: () => ({
            kind: "gamepadAxis",
            axis,
            threshold: positive ? th : -th,
            ...(pad !== 0 ? { padIndex: pad } : {}),
          }),
        });
      });
    }

    if (!cap.armed) {
      cap.armed = true;
      for (const d of down) cap.ignored.add(d.id);
      return;
    }
    const downIds = new Set(down.map((d) => d.id));
    for (const id of [...cap.ignored])
      if (!downIds.has(id)) cap.ignored.delete(id);

    for (const d of down) {
      if (cap.ignored.has(d.id)) continue;
      if (d.code !== undefined) {
        if (cancel.includes(d.code)) {
          this._swallow(d.id, keys, d.code);
          cap.finish(null);
          return;
        }
        if (!kinds.includes("key")) continue;
        if (MODIFIER_CODES.has(d.code) && opts.allowModifiers !== true)
          continue;
      } else if (d.id.startsWith("b:")) {
        if (!kinds.includes("gamepadButton")) continue;
      } else if (!kinds.includes("gamepadAxis")) continue;
      const binding = d.make();
      this._swallow(d.id, keys, d.code);
      cap.finish({ binding, label: this.bindingLabel(binding) });
      return;
    }
  }

  private _swallow(
    id: string,
    keys: Map<string, boolean>,
    code?: string,
  ): void {
    this._suppressed.add(id);
    if (code !== undefined) keys.set(code, false);
  }

  private _keyBinding(code: string, charMode: boolean): Binding {
    if (charMode) {
      const layout = this._input.layout;
      const ch = layout.charForCode(code);
      if (
        ch !== undefined &&
        isLetterChar(ch) &&
        layout.codeForChar(ch) === code
      ) {
        return { kind: "key", code, char: ch };
      }
    }
    return { kind: "key", code };
  }

  private _rawGamepadIdDown(
    id: string,
    gamepads: ReadonlyMap<number, GamepadState>,
  ): boolean {
    const parts = id.split(":");
    const pad = Number(parts[1]);
    const st = gamepads.get(pad);
    if (st === undefined) return false;
    if (parts[0] === "b") return st.buttons[Number(parts[2])] === true;
    const v = st.axes[Number(parts[2])];
    if (v === undefined) return false;
    // Stay suppressed until the axis comes back inside the deadband.
    return parts[3] === "+" ? v >= 0.25 : v <= -0.25;
  }

  private _resolveKeyCode(b: { code: string; char?: string }): string {
    if (b.char === undefined) return b.code;
    return this._input.layout.codeForChar(b.char) ?? b.code;
  }

  /** Human label for a binding ("A", "Q", "Space", "Pad A", "Axis 1+"). Key labels follow the active layout. */
  bindingLabel(b: Binding): string {
    switch (b.kind) {
      case "key":
        return this._input.layout.label(this._resolveKeyCode(b));
      case "gamepadButton": {
        const name = PAD_BUTTON_NAMES[b.index] ?? String(b.index);
        return `${b.padIndex ? `P${b.padIndex + 1} ` : ""}Pad ${name}`;
      }
      case "gamepadAxis":
        return `${b.padIndex ? `P${b.padIndex + 1} ` : ""}Axis ${b.axis}${
          b.threshold >= 0 ? "+" : "-"
        }`;
    }
  }

  private _isBindingActive(b: Binding): boolean {
    switch (b.kind) {
      case "key":
        return this._frozen.keys.get(this._resolveKeyCode(b)) === true;
      case "gamepadButton": {
        const pad = b.padIndex ?? 0;
        if (this._suppressed.has(`b:${pad}:${b.index}`)) return false;
        const state = this._frozen.gamepads.get(pad);
        return state?.buttons[b.index] === true;
      }
      case "gamepadAxis": {
        const pad = b.padIndex ?? 0;
        if (
          this._suppressed.has(axisSuppressId(pad, b.axis, b.threshold >= 0))
        ) {
          return false;
        }
        const state = this._frozen.gamepads.get(pad);
        const v = state?.axes[b.axis];
        if (v === undefined) return false;
        return b.threshold >= 0 ? v >= b.threshold : v <= b.threshold;
      }
    }
  }
}

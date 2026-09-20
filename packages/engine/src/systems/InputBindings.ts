// InputBindings — accessibility primitive #1: named actions instead of raw
// key codes, with runtime rebinding persisted through SaveSystem.
//
// Games should query `isActionActive("jump")` rather than
// `input.isKeyDown("Space")` so that a player can remap controls without the
// game's own code ever branching on a physical key.

import { z } from "zod";
import type { InputSystem } from "./InputSystem.js";
import type { GamepadSystem } from "./GamepadSystem.js";
import { SaveSystem } from "./SaveSystem.js";

export type BindingKind =
  | "key"
  | "mouseButton"
  | "gamepadButton"
  | "gamepadAxis";

export interface KeyBinding {
  readonly kind: "key";
  readonly code: string;
}
export interface MouseButtonBinding {
  readonly kind: "mouseButton";
  readonly button: number;
}
export interface GamepadButtonBinding {
  readonly kind: "gamepadButton";
  readonly index: number;
  readonly padIndex?: number | undefined;
}
export interface GamepadAxisBinding {
  readonly kind: "gamepadAxis";
  readonly axis: number;
  /** Threshold beyond which the axis counts as "active". Sign matters. */
  readonly threshold: number;
  readonly padIndex?: number | undefined;
}

export type Binding =
  | KeyBinding
  | MouseButtonBinding
  | GamepadButtonBinding
  | GamepadAxisBinding;

export type ActionMap = Record<string, Binding[]>;

/**
 * The save-slot shape for persisted bindings, used with `SaveSystem`'s
 * generic schema constructor: `new SaveSystem("emptysock_save_", BindingsSaveSlotSchema)`.
 */
export interface BindingsSaveSlot {
  readonly id: string;
  readonly bindings: ActionMap;
}

const BindingSchema: z.ZodType<Binding> = z.union([
  z.object({ kind: z.literal("key"), code: z.string() }),
  z.object({ kind: z.literal("mouseButton"), button: z.number() }),
  z.object({
    kind: z.literal("gamepadButton"),
    index: z.number(),
    padIndex: z.number().optional(),
  }),
  z.object({
    kind: z.literal("gamepadAxis"),
    axis: z.number(),
    threshold: z.number(),
    padIndex: z.number().optional(),
  }),
]);

export const BindingsSaveSlotSchema: z.ZodType<BindingsSaveSlot> = z.object({
  id: z.string(),
  bindings: z.record(z.string(), z.array(BindingSchema)),
});

/** A `SaveSystem` pre-configured with the bindings slot schema. */
export function createBindingsSaveSystem(
  prefix?: string,
): SaveSystem<BindingsSaveSlot> {
  return new SaveSystem<BindingsSaveSlot>(prefix, BindingsSaveSlotSchema);
}

const SAVE_SLOT_ID = "__input_bindings__";

export class InputBindings {
  private readonly _input: InputSystem;
  private readonly _gamepad: GamepadSystem | null;
  private readonly _defaults: ActionMap;
  private _bindings: ActionMap;

  constructor(
    input: InputSystem,
    defaults: ActionMap,
    gamepad: GamepadSystem | null = null,
  ) {
    this._input = input;
    this._gamepad = gamepad;
    this._defaults = defaults;
    this._bindings = cloneMap(defaults);
  }

  /** True if any binding for this action is currently active. */
  isActionActive(action: string): boolean {
    const bindings = this._bindings[action];
    if (bindings === undefined) return false;
    for (const b of bindings) {
      if (this._isBindingActive(b)) return true;
    }
    return false;
  }

  /** True the frame the action transitions from inactive to active. */
  isActionPressed(action: string): boolean {
    const bindings = this._bindings[action];
    if (bindings === undefined) return false;
    for (const b of bindings) {
      if (b.kind === "key" && this._input.isKeyPressed(b.code)) return true;
    }
    // Gamepad/mouse "pressed" edges aren't tracked at this layer; callers
    // needing edge detection on those should compare frame-to-frame state.
    return false;
  }

  /** Replace all bindings for an action (rebind). */
  rebind(action: string, bindings: Binding[]): void {
    this._bindings = { ...this._bindings, [action]: [...bindings] };
  }

  /** Add a single binding to an action without clearing existing ones. */
  addBinding(action: string, binding: Binding): void {
    const existing = this._bindings[action] ?? [];
    this._bindings = { ...this._bindings, [action]: [...existing, binding] };
  }

  getBindings(action: string): ReadonlyArray<Binding> {
    return this._bindings[action] ?? [];
  }

  get actions(): ReadonlyArray<string> {
    return Object.keys(this._bindings);
  }

  resetToDefaults(): void {
    this._bindings = cloneMap(this._defaults);
  }

  /**
   * Persist the current bindings via SaveSystem's generic slot API. Pass a
   * `SaveSystem<BindingsSaveSlot>` (e.g. from `createBindingsSaveSystem()`),
   * not the default `GameSaveSlot`-shaped `SaveSystem`.
   */
  save(
    save: SaveSystem<BindingsSaveSlot>,
    slotId: string = SAVE_SLOT_ID,
  ): void {
    save.save(slotId, { bindings: this._bindings });
  }

  /** Load previously persisted bindings, if any. Returns true if applied. */
  load(
    save: SaveSystem<BindingsSaveSlot>,
    slotId: string = SAVE_SLOT_ID,
  ): boolean {
    const slot = save.load(slotId);
    if (slot === null) return false;
    this._bindings = slot.bindings;
    return true;
  }

  private _isBindingActive(b: Binding): boolean {
    switch (b.kind) {
      case "key":
        return this._input.isKeyDown(b.code);
      case "mouseButton":
        return this._input.isMouseDown(b.button);
      case "gamepadButton": {
        const state = this._gamepad?.getState(b.padIndex ?? 0);
        return state?.buttons[b.index] === true;
      }
      case "gamepadAxis": {
        const state = this._gamepad?.getState(b.padIndex ?? 0);
        const v = state?.axes[b.axis];
        if (v === undefined) return false;
        return b.threshold >= 0 ? v >= b.threshold : v <= b.threshold;
      }
    }
  }
}

function cloneMap(map: ActionMap): ActionMap {
  const out: ActionMap = {};
  for (const [k, v] of Object.entries(map)) out[k] = [...v];
  return out;
}

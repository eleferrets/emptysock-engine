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
export declare const BindingsSaveSlotSchema: z.ZodType<BindingsSaveSlot>;
/** A `SaveSystem` pre-configured with the bindings slot schema. */
export declare function createBindingsSaveSystem(
  prefix?: string,
): SaveSystem<BindingsSaveSlot>;
export declare class InputBindings {
  private readonly _input;
  private readonly _gamepad;
  private readonly _defaults;
  private _bindings;
  constructor(
    input: InputSystem,
    defaults: ActionMap,
    gamepad?: GamepadSystem | null,
  );
  /** True if any binding for this action is currently active. */
  isActionActive(action: string): boolean;
  /** True the frame the action transitions from inactive to active. */
  isActionPressed(action: string): boolean;
  /** Replace all bindings for an action (rebind). */
  rebind(action: string, bindings: Binding[]): void;
  /** Add a single binding to an action without clearing existing ones. */
  addBinding(action: string, binding: Binding): void;
  getBindings(action: string): ReadonlyArray<Binding>;
  get actions(): ReadonlyArray<string>;
  resetToDefaults(): void;
  /**
   * Persist the current bindings via SaveSystem's generic slot API. Pass a
   * `SaveSystem<BindingsSaveSlot>` (e.g. from `createBindingsSaveSystem()`),
   * not the default `GameSaveSlot`-shaped `SaveSystem`.
   */
  save(save: SaveSystem<BindingsSaveSlot>, slotId?: string): void;
  /** Load previously persisted bindings, if any. Returns true if applied. */
  load(save: SaveSystem<BindingsSaveSlot>, slotId?: string): boolean;
  private _isBindingActive;
}

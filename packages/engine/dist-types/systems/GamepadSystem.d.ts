export interface GamepadState {
  readonly connected: boolean;
  readonly buttons: ReadonlyArray<boolean>;
  readonly axes: ReadonlyArray<number>;
}
export interface DualRumbleOptions {
  readonly weakMagnitude: number;
  readonly strongMagnitude: number;
  readonly duration: number;
}
export declare class GamepadSystem {
  private readonly _states;
  private readonly _prevButtons;
  update(): void;
  getState(index: number): GamepadState | null;
  /** True if the button went from not-pressed to pressed this frame. */
  isButtonPressed(padIndex: number, button: number): boolean;
  /** True if the button went from pressed to not-pressed this frame. */
  isButtonReleased(padIndex: number, button: number): boolean;
  /** True if the button is currently held down. */
  isButtonDown(padIndex: number, button: number): boolean;
  rumble(index: number, intensity: number, duration: number): void;
  rumbleDual(index: number, opts: DualRumbleOptions): void;
  destroy(): void;
}

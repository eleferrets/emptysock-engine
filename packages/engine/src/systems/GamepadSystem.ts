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

interface VibrationActuator {
  playEffect(type: string, params: unknown): void;
}

interface GamepadWithVibration {
  connected: boolean;
  buttons: ReadonlyArray<GamepadButton>;
  axes: ReadonlyArray<number>;
  vibrationActuator?: VibrationActuator;
}

export class GamepadSystem {
  private readonly _states: Map<number, GamepadState> = new Map();
  private readonly _prevButtons: Map<number, ReadonlyArray<boolean>> =
    new Map();

  update(): void {
    if (
      typeof navigator === "undefined" ||
      typeof navigator.getGamepads !== "function"
    )
      return;
    const pads = navigator.getGamepads();

    // Snapshot previous button states before overwriting
    for (const [idx, state] of this._states) {
      this._prevButtons.set(idx, state.buttons);
    }

    for (let i = 0; i < pads.length; i++) {
      const pad = pads[i];
      if (pad === null || pad === undefined) {
        this._states.delete(i);
        this._prevButtons.delete(i);
        continue;
      }
      this._states.set(i, {
        connected: pad.connected,
        buttons: pad.buttons.map((b) => b.pressed),
        axes: Array.from(pad.axes),
      });
    }
  }

  getState(index: number): GamepadState | null {
    return this._states.get(index) ?? null;
  }

  /** True if the button went from not-pressed to pressed this frame. */
  isButtonPressed(padIndex: number, button: number): boolean {
    const curr = this._states.get(padIndex)?.buttons[button] ?? false;
    const prev = this._prevButtons.get(padIndex)?.[button] ?? false;
    return curr && !prev;
  }

  /** True if the button went from pressed to not-pressed this frame. */
  isButtonReleased(padIndex: number, button: number): boolean {
    const curr = this._states.get(padIndex)?.buttons[button] ?? false;
    const prev = this._prevButtons.get(padIndex)?.[button] ?? false;
    return !curr && prev;
  }

  /** True if the button is currently held down. */
  isButtonDown(padIndex: number, button: number): boolean {
    return this._states.get(padIndex)?.buttons[button] ?? false;
  }

  rumble(index: number, intensity: number, duration: number): void {
    if (
      typeof navigator === "undefined" ||
      typeof navigator.getGamepads !== "function"
    )
      return;
    const pads = navigator.getGamepads();
    const pad = pads[index] as GamepadWithVibration | null | undefined;
    if (pad === null || pad === undefined) return;
    pad.vibrationActuator?.playEffect("dual-rumble", {
      startDelay: 0,
      duration,
      weakMagnitude: intensity,
      strongMagnitude: intensity,
    });
  }

  rumbleDual(index: number, opts: DualRumbleOptions): void {
    if (
      typeof navigator === "undefined" ||
      typeof navigator.getGamepads !== "function"
    )
      return;
    const pads = navigator.getGamepads();
    const pad = pads[index] as GamepadWithVibration | null | undefined;
    if (pad === null || pad === undefined) return;
    pad.vibrationActuator?.playEffect("dual-rumble", {
      startDelay: 0,
      duration: opts.duration,
      weakMagnitude: opts.weakMagnitude,
      strongMagnitude: opts.strongMagnitude,
    });
  }

  destroy(): void {
    this._states.clear();
    this._prevButtons.clear();
  }
}

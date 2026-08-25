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

interface GamepadWithVibration extends Gamepad {
  vibrationActuator?: {
    playEffect(type: string, params: unknown): void;
  };
}

export class GamepadSystem {
  private readonly _states: Map<number, GamepadState> = new Map();

  update(): void {
    const pads = navigator.getGamepads();
    for (let i = 0; i < pads.length; i++) {
      const pad = pads[i];
      if (pad === null || pad === undefined) {
        this._states.delete(i);
        continue;
      }
      this._states.set(i, {
        connected: pad.connected,
        buttons: pad.buttons.map(b => b.pressed),
        axes: Array.from(pad.axes),
      });
    }
  }

  getState(index: number): GamepadState | null {
    return this._states.get(index) ?? null;
  }

  rumble(index: number, intensity: number, duration: number): void {
    const pads = navigator.getGamepads();
    const pad = pads[index] as GamepadWithVibration | null | undefined;
    if (pad === null || pad === undefined) return;
    pad.vibrationActuator?.playEffect('dual-rumble', {
      startDelay: 0,
      duration,
      weakMagnitude: intensity,
      strongMagnitude: intensity,
    });
  }

  rumbleDual(index: number, opts: DualRumbleOptions): void {
    const pads = navigator.getGamepads();
    const pad = pads[index] as GamepadWithVibration | null | undefined;
    if (pad === null || pad === undefined) return;
    pad.vibrationActuator?.playEffect('dual-rumble', {
      startDelay: 0,
      duration: opts.duration,
      weakMagnitude: opts.weakMagnitude,
      strongMagnitude: opts.strongMagnitude,
    });
  }
}

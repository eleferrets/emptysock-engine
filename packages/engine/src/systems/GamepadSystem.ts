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

export class GamepadSystem {
  private readonly _states: Map<number, GamepadState> = new Map();

  update(): void {
    const pads = navigator.getGamepads();
    for (let i = 0; i < pads.length; i++) {
      const pad = pads[i];
      if (pad === null) {
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
    const pad = pads[index];
    if (pad === null) return;
    // vibrationActuator is non-standard; guard carefully
    const actuator = (pad as unknown as { vibrationActuator?: { playEffect(type: string, params: unknown): void } }).vibrationActuator;
    if (actuator === undefined) return;
    actuator.playEffect('dual-rumble', {
      startDelay: 0,
      duration,
      weakMagnitude: intensity,
      strongMagnitude: intensity,
    });
  }

  rumbleDual(index: number, opts: DualRumbleOptions): void {
    const pads = navigator.getGamepads();
    const pad = pads[index];
    if (pad === null) return;
    const actuator = (pad as unknown as { vibrationActuator?: { playEffect(type: string, params: unknown): void } }).vibrationActuator;
    if (actuator === undefined) return;
    actuator.playEffect('dual-rumble', {
      startDelay: 0,
      duration: opts.duration,
      weakMagnitude: opts.weakMagnitude,
      strongMagnitude: opts.strongMagnitude,
    });
  }
}

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
  update(): void;
  getState(index: number): GamepadState | null;
  rumble(index: number, intensity: number, duration: number): void;
  rumbleDual(index: number, opts: DualRumbleOptions): void;
}
//# sourceMappingURL=GamepadSystem.d.ts.map

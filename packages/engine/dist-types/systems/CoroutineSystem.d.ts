export type CoroutineYield =
  | {
      type: "frames";
      count: number;
    }
  | {
      type: "seconds";
      duration: number;
    }
  | {
      type: "condition";
      check: () => boolean;
    };
export type CoroutineGen = Generator<CoroutineYield, void, unknown>;
export declare function waitFrames(n: number): CoroutineYield;
export declare function waitSeconds(t: number): CoroutineYield;
export declare function waitUntil(fn: () => boolean): CoroutineYield;
export declare class CoroutineSystem {
  private readonly _coroutines;
  /**
   * Called when a coroutine throws. Receives the coroutine id and the error.
   * The coroutine is stopped before this is called.
   * When unset, errors are logged to `console.error`.
   */
  onError: ((id: string, error: Error) => void) | null;
  start(id: string, gen: CoroutineGen): void;
  stop(id: string): void;
  update(deltaTime: number): void;
  /**
   * Stop all running coroutines by returning from each generator, then clear
   * the map. The system remains usable; new coroutines can be started after
   * this call.
   */
  stopAll(): void;
  /** Cancel all running coroutines. The system remains usable; new coroutines can be started after this call. */
  destroy(): void;
  private _step;
}

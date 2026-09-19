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
  start(id: string, gen: CoroutineGen): void;
  stop(id: string): void;
  update(deltaTime: number): void;
  /** Stop all running coroutines. */
  destroy(): void;
  private _step;
}

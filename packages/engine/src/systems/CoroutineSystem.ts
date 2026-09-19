export type CoroutineYield =
  | { type: "frames"; count: number }
  | { type: "seconds"; duration: number }
  | { type: "condition"; check: () => boolean };

export type CoroutineGen = Generator<CoroutineYield, void, unknown>;

export function waitFrames(n: number): CoroutineYield {
  return { type: "frames", count: n };
}

export function waitSeconds(t: number): CoroutineYield {
  return { type: "seconds", duration: t };
}

export function waitUntil(fn: () => boolean): CoroutineYield {
  return { type: "condition", check: fn };
}

interface CoroutineState {
  gen: CoroutineGen;
  waiting:
    | { type: "frames"; remaining: number }
    | { type: "seconds"; remaining: number }
    | { type: "condition"; check: () => boolean }
    | null;
}

export class CoroutineSystem {
  private readonly _coroutines: Map<string, CoroutineState> = new Map();

  start(id: string, gen: CoroutineGen): void {
    if (this._coroutines.has(id)) {
      console.warn(
        `[CoroutineSystem] duplicate coroutine id "${id}" — stopping the previous one`,
      );
      this._coroutines.delete(id);
    }
    this._coroutines.set(id, { gen, waiting: null });
    // Advance to the first yield immediately
    this._step(id);
  }

  stop(id: string): void {
    this._coroutines.delete(id);
  }

  update(deltaTime: number): void {
    for (const [id, state] of [...this._coroutines]) {
      const w = state.waiting;
      if (w === null) continue;

      let ready = false;
      if (w.type === "frames") {
        w.remaining -= 1;
        ready = w.remaining <= 0;
      } else if (w.type === "seconds") {
        w.remaining -= deltaTime;
        ready = w.remaining <= 0;
      } else {
        ready = w.check();
      }

      if (ready) {
        state.waiting = null;
        this._step(id);
      }
    }
  }

  /** Cancel all running coroutines. The system remains usable; new coroutines can be started after this call. */
  destroy(): void {
    this._coroutines.clear();
  }

  private _step(id: string): void {
    const state = this._coroutines.get(id);
    if (state === undefined) return;

    const result = state.gen.next();
    if (result.done === true) {
      this._coroutines.delete(id);
      return;
    }

    const y = result.value;
    if (y.type === "frames") {
      state.waiting = { type: "frames", remaining: y.count };
    } else if (y.type === "seconds") {
      state.waiting = { type: "seconds", remaining: y.duration };
    } else {
      state.waiting = { type: "condition", check: y.check };
    }
  }
}

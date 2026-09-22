export type KeyState = "up" | "down" | "pressed" | "released";

export class InputSystem {
  private readonly _keys: Map<string, boolean> = new Map();
  private readonly _prevKeys: Map<string, boolean> = new Map();

  private _boundTarget: EventTarget | null = null;

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  /**
   * Keyboard-only. Mouse and touch used to be tracked here too, but had zero
   * real consumers outside this file (confirmed by a real-usage audit) and
   * duplicated what `PointerSystem` already does better — a real Pointer
   * Events-based unification of mouse/touch/pen plus tap/longpress/swipe/
   * pinch gesture recognition. `ecs/Input.ts`'s `InputManager` now wraps
   * `PointerSystem` directly for all of that; this class stays keyboard-only.
   */
  attach(target: EventTarget = window): void {
    this._boundTarget = target;
    target.addEventListener("keydown", this._onKeyDown);
    target.addEventListener("keyup", this._onKeyUp);
  }

  detach(): void {
    if (this._boundTarget === null) return;
    const t = this._boundTarget;
    t.removeEventListener("keydown", this._onKeyDown);
    t.removeEventListener("keyup", this._onKeyUp);
    this._boundTarget = null;
  }

  /** Call at end of each frame to flush pressed/released states. */
  flush(): void {
    this._prevKeys.clear();
    for (const [k, v] of this._keys) this._prevKeys.set(k, v);
  }

  // ─── Key queries ─────────────────────────────────────────────────────────

  isKeyDown(code: string): boolean {
    return this._keys.get(code) === true;
  }
  isKeyPressed(code: string): boolean {
    return this._keys.get(code) === true && this._prevKeys.get(code) !== true;
  }
  isKeyReleased(code: string): boolean {
    return this._keys.get(code) !== true && this._prevKeys.get(code) === true;
  }

  /**
   * A point-in-time copy of every key currently tracked. Used by
   * `ecs/Input.ts`'s `InputManager.snapshot()` to freeze keyboard state for
   * a frame (ENGINE_DESIGN.md §4 step 1) — reading this once and caching
   * the result, rather than reading `isKeyDown` live, is what makes
   * "polled once, frozen for the frame" true even though this class itself
   * updates `_keys` continuously as DOM events arrive.
   */
  snapshotKeys(): ReadonlyMap<string, boolean> {
    return new Map(this._keys);
  }

  /**
   * Test-only, non-DOM input injection. Drives the same internal state a
   * real `keydown`/`keyup` event would, without constructing a
   * `KeyboardEvent` or touching `window` — this is what keeps input testable
   * under a headless Node harness (CLAUDE.md's engine-environment-boundary
   * rule: no DOM dependency on this path).
   */
  simulateKeyDown(code: string): void {
    this._keys.set(code, true);
  }

  /** See `simulateKeyDown`. */
  simulateKeyUp(code: string): void {
    this._keys.set(code, false);
  }

  // ─── Event handlers ───────────────────────────────────────────────────────

  private readonly _onKeyDown = (e: Event): void => {
    this._keys.set((e as KeyboardEvent).code, true);
  };
  private readonly _onKeyUp = (e: Event): void => {
    this._keys.set((e as KeyboardEvent).code, false);
  };

  /** Alias for `detach()` — compatible with SystemManager teardown. */
  destroy(): void {
    this.detach();
  }
}

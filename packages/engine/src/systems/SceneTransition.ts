export type TransitionEffect = "none" | "fade" | "wipe" | "slide";

export interface TransitionOptions {
  duration?: number;
  colour?: number;
  /** Visual style for the transition. Defaults to "none" (instant cut). */
  effect?: TransitionEffect;
}

/**
 * The slice of `PostProcessSystem` `SceneTransitionManager` needs to drive a
 * transition's visuals. Kept minimal so this class doesn't depend on the
 * full `PostProcessSystem` class shape, only the transition fields/methods
 * it actually writes to.
 */
export interface TransitionEffectSink {
  beginTransition(effect: TransitionEffect, colour?: number): void;
  endTransition(): void;
  transitionProgress: number;
}

/**
 * Scene-transition **timing** logic —
 * deliberately not scene registration/lifecycle. `Game.ts` already owns
 * real scene swapping (`loadScene()`/`loadOverlay()`/`unloadScene()`) with
 * its own lifecycle guarantees — this class's only job is timing a
 * transition's visual progress and calling a caller-supplied `load`
 * callback (typically `() => game.loadScene(...)`) once the transition's
 * midpoint duration elapses. A pause/resume scene stack, if ever wanted, is
 * a separate, real design question for `Game.ts` itself — not something to
 * bolt onto this class.
 *
 * Also **not a singleton** — see CLAUDE.md's "PluginSystem, VariableStore,
 * LocalisationSystem, ViewportSystem, and WindowSystem are Game services"
 * entry for why a bare module-level singleton is a shared-mutable-state
 * hazard across test files. A game constructs its own
 * `new SceneTransitionManager()` (typically once, held by the game's own
 * bootstrap code, not `Game` itself — `Game.ts` has no opinion on
 * transitions, same as it has none on rendering).
 */
export class SceneTransitionManager {
  private _pending: (() => void | Promise<void>) | null = null;
  private _pendingOptions: TransitionOptions | null = null;
  private _transitioning = false;
  private _elapsed = 0;
  private _postProcess: TransitionEffectSink | null = null;

  /**
   * Attach the `PostProcessSystem` instance (or anything else satisfying
   * `TransitionEffectSink`) whose transition fields drive
   * `RenderPipeline.renderTransitionOverlay()`. Optional — without it,
   * transitions still time and call `load` correctly, they just render as
   * an instant cut.
   */
  attachPostProcess(sink: TransitionEffectSink | null): void {
    this._postProcess = sink;
  }

  get isTransitioning(): boolean {
    return this._transitioning;
  }

  /**
   * Begin a timed transition. `load` is called once, when `options.duration`
   * (default 0.3s) has elapsed since this call — typically
   * `() => game.loadScene(nextScene)`. Calling `transition()` again while
   * one is already in flight replaces the pending `load` and resets the
   * elapsed timer — "last call wins"; it never queues multiple pending
   * transitions.
   */
  transition(
    load: () => void | Promise<void>,
    options: TransitionOptions = {},
  ): void {
    this._pending = load;
    this._pendingOptions = options;
    this._transitioning = true;
    this._elapsed = 0;
    this._postProcess?.beginTransition(
      options.effect ?? "none",
      options.colour,
    );
  }

  /** Call once per frame with delta-time in seconds. Fires the pending `load` and ends the transition once its duration has elapsed. */
  update(deltaTime: number): void {
    if (this._pending === null || !this._transitioning) return;
    const duration = this._pendingOptions?.duration ?? 0.3;
    this._elapsed += deltaTime;
    const progress = duration > 0 ? Math.min(this._elapsed / duration, 1) : 1;
    if (this._postProcess !== null)
      this._postProcess.transitionProgress = progress;
    if (this._elapsed >= duration) this._complete();
  }

  private _complete(): void {
    const load = this._pending;
    this._pending = null;
    this._pendingOptions = null;
    this._transitioning = false;
    this._elapsed = 0;
    void load?.();
    this._postProcess?.endTransition();
  }
}

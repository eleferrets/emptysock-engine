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
 * Scene-transition **timing** logic (RELEASE_PASS.md Track 6) —
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
export declare class SceneTransitionManager {
  private _pending;
  private _pendingOptions;
  private _transitioning;
  private _elapsed;
  private _postProcess;
  /**
   * Attach the `PostProcessSystem` instance (or anything else satisfying
   * `TransitionEffectSink`) whose transition fields drive
   * `RenderPipeline.renderTransitionOverlay()`. Optional — without it,
   * transitions still time and call `load` correctly, they just render as
   * an instant cut.
   */
  attachPostProcess(sink: TransitionEffectSink | null): void;
  get isTransitioning(): boolean;
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
    options?: TransitionOptions,
  ): void;
  /** Call once per frame with delta-time in seconds. Fires the pending `load` and ends the transition once its duration has elapsed. */
  update(deltaTime: number): void;
  private _complete;
}
//# sourceMappingURL=SceneTransition.d.ts.map

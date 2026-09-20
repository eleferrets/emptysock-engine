import type { Scene } from "./Scene.js";

/**
 * Visual style for a scene transition. Actual pixels are drawn by
 * `RenderPipeline.renderTransitionOverlay()`, driven by the
 * `PostProcessSystem` state this class updates each frame — SceneManager
 * itself stays render-agnostic (no pixi/DOM imports), per the engine
 * environment boundary.
 */
export type TransitionEffect = "none" | "fade" | "wipe" | "slide";

export interface TransitionOptions {
  duration?: number;
  colour?: number;
  /** Visual style for the transition. Defaults to "none" (instant cut). */
  effect?: TransitionEffect;
}

export type SceneFactory = () => Scene;

/**
 * The slice of PostProcessSystem SceneManager needs to drive a transition's
 * visuals. Kept minimal so SceneManager doesn't depend on the full
 * PostProcessSystem class shape, only the transition fields/methods it
 * actually writes to.
 */
export interface TransitionEffectSink {
  beginTransition(effect: TransitionEffect, colour?: number): void;
  endTransition(): void;
  transitionProgress: number;
}

class SceneManager {
  private readonly _registry: Map<string, SceneFactory> = new Map();
  private _active: Scene | null = null;
  private readonly _stack: Scene[] = [];
  private _pending: string | null = null;
  private _pendingOptions: TransitionOptions | null = null;
  private _transitioning: boolean = false;
  private _elapsed: number = 0;
  private _isLoading: boolean = false;
  private _fixedAccum: number = 0;
  /** Fixed physics timestep in seconds. Default 1/60. */
  public fixedTimeStep: number = 1 / 60;
  private _postProcess: TransitionEffectSink | null = null;

  /**
   * Attach the PostProcessSystem instance whose transitionEffect/
   * transitionProgress/transitionColour drive `RenderPipeline`'s transition
   * overlay. Optional — without it, transitions still time and switch
   * scenes correctly, they just render as an instant cut.
   */
  attachPostProcess(sink: TransitionEffectSink | null): void {
    this._postProcess = sink;
  }

  /** Register a factory so the scene can be loaded by name. */
  register(name: string, factory: SceneFactory): void {
    this._registry.set(name, factory);
  }

  get current(): Scene | null {
    return this._active;
  }

  get isTransitioning(): boolean {
    return this._transitioning;
  }

  /** True while an async onLoad() is in flight. update() is skipped during this time. */
  get isLoading(): boolean {
    return this._isLoading;
  }

  /**
   * Push a new scene on top of the current one. The current scene is paused
   * but stays in memory. Its onDestroy is NOT called — use popScene() to resume.
   * onLoad() on the incoming scene runs before the first update tick.
   */
  pushScene(scene: Scene): void {
    if (this._active !== null) {
      this._active._callOnPause();
      this._active.stop();
      this._stack.push(this._active);
    }
    this._active = scene;
    this._active.start();
    this._isLoading = true;
    scene
      .onLoad()
      .then(() => {
        this._isLoading = false;
        scene._callOnStart();
      })
      .catch((err: unknown) => {
        this._isLoading = false;
        console.error("[SceneManager] onLoad error:", err);
      });
  }

  /**
   * Pop the current scene off the stack and resume the scene underneath.
   * Calls onDestroy() on the popped scene and clears its UI.
   * No-op if the stack is empty.
   */
  popScene(): void {
    if (this._active !== null) {
      this._active.onDestroy();
      this._active.ui.clear();
      this._active.stop();
    }
    const prev = this._stack.pop();
    this._active = prev ?? null;
    if (this._active !== null) {
      this._active.start();
      this._active._callOnResume();
    }
  }

  get stackDepth(): number {
    return this._stack.length + (this._active !== null ? 1 : 0);
  }

  /**
   * Immediately load a scene by name (no transition animation).
   * onDestroy() is called on the current scene first.
   * onLoad() on the new scene runs asynchronously; update() is skipped until it resolves.
   */
  load(name: string): Scene {
    const factory = this._registry.get(name);
    if (factory === undefined) {
      throw new Error(`SceneManager: no scene registered as "${name}"`);
    }
    if (this._active !== null) {
      this._active.onDestroy();
      this._active.ui.clear();
      this._active.stop();
    }
    const next = factory();
    this._active = next;
    next.start();
    this._isLoading = true;
    next
      .onLoad()
      .then(() => {
        this._isLoading = false;
        next._callOnStart();
      })
      .catch((err: unknown) => {
        this._isLoading = false;
        console.error("[SceneManager] onLoad error:", err);
      });
    return next;
  }

  /**
   * Queue a scene transition. The transition completes on the next `update()`
   * call when duration has elapsed.
   */
  transition(name: string, options: TransitionOptions = {}): void {
    this._pending = name;
    this._pendingOptions = options;
    this._transitioning = true;
    this._elapsed = 0;
    const effect = options.effect ?? "none";
    this._postProcess?.beginTransition(effect, options.colour);
  }

  update(deltaTime: number): void {
    if (!this._isLoading) {
      this._fixedAccum += deltaTime;
      while (this._fixedAccum >= this.fixedTimeStep) {
        this._active?._fixedUpdate(this.fixedTimeStep);
        this._fixedAccum -= this.fixedTimeStep;
      }
      this._active?.update(deltaTime);
    }

    // Invariant: _pending !== null implies _transitioning === true.
    // transition() is the only way to set _pending, and it always sets
    // _transitioning = true at the same time. _completeTransition() clears
    // both atomically, so the !_transitioning branch is unreachable under
    // normal control flow. We keep a single branch here to enforce the
    // invariant and avoid processing a stale _pending without a transition.
    if (this._pending !== null && this._transitioning) {
      const duration = this._pendingOptions?.duration ?? 0.3;
      this._elapsed += deltaTime;
      const progress = duration > 0 ? Math.min(this._elapsed / duration, 1) : 1;
      if (this._postProcess !== null)
        this._postProcess.transitionProgress = progress;
      if (this._elapsed >= duration) {
        this._completeTransition();
      }
    }
  }

  private _completeTransition(): void {
    if (this._pending === null) return;
    this.load(this._pending);
    this._pending = null;
    this._pendingOptions = null;
    this._transitioning = false;
    this._elapsed = 0;
    this._postProcess?.endTransition();
  }
}

export const SceneManagerInstance = new SceneManager();

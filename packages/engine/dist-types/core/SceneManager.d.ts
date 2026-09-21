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
declare class SceneManager {
  private readonly _registry;
  private _active;
  private readonly _stack;
  private _pending;
  private _pendingOptions;
  private _transitioning;
  private _elapsed;
  private _isLoading;
  private _fixedAccum;
  /** Fixed physics timestep in seconds. Default 1/60. */
  fixedTimeStep: number;
  private _postProcess;
  /**
   * Attach the PostProcessSystem instance whose transitionEffect/
   * transitionProgress/transitionColour drive `RenderPipeline`'s transition
   * overlay. Optional — without it, transitions still time and switch
   * scenes correctly, they just render as an instant cut.
   */
  attachPostProcess(sink: TransitionEffectSink | null): void;
  /** Register a factory so the scene can be loaded by name. */
  register(name: string, factory: SceneFactory): void;
  get current(): Scene | null;
  get isTransitioning(): boolean;
  /** True while an async onLoad() is in flight. update() is skipped during this time. */
  get isLoading(): boolean;
  /**
   * Push a new scene on top of the current one. The current scene is paused
   * but stays in memory. Its onDestroy is NOT called — use popScene() to resume.
   * onLoad() on the incoming scene runs before the first update tick.
   */
  pushScene(scene: Scene): void;
  /**
   * Pop the current scene off the stack and resume the scene underneath.
   * Calls onDestroy() on the popped scene and clears its UI.
   * No-op if the stack is empty.
   */
  popScene(): void;
  get stackDepth(): number;
  /**
   * Immediately load a scene by name (no transition animation).
   * onDestroy() is called on the current scene first.
   * onLoad() on the new scene runs asynchronously; update() is skipped until it resolves.
   */
  load(name: string): Scene;
  /**
   * Queue a scene transition. The transition completes on the next `update()`
   * call when duration has elapsed.
   */
  transition(name: string, options?: TransitionOptions): void;
  update(deltaTime: number): void;
  private _completeTransition;
}
export declare const SceneManagerInstance: SceneManager;
export {};

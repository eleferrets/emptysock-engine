import type { Scene } from "./Scene.js";
export type TransitionEffect =
  | "fade"
  | "wipe"
  | "iris"
  | "slide"
  | "zoom"
  | "dissolve"
  | "flash"
  | "none";
export interface TransitionOptions {
  effect?: TransitionEffect;
  duration?: number;
  colour?: number;
}
export type SceneFactory = () => Scene;
declare class SceneManager {
  private readonly _registry;
  private _active;
  private readonly _stack;
  private _pending;
  private _pendingOptions;
  private _transitioning;
  private _elapsed;
  private _isLoading;
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
  queue(name: string): void;
  update(deltaTime: number): void;
  private _completeTransition;
}
export declare const SceneManagerInstance: SceneManager;
export {};

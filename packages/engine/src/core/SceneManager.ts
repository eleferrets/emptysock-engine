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

class SceneManager {
  private readonly _registry: Map<string, SceneFactory> = new Map();
  private _active: Scene | null = null;
  private _pending: string | null = null;
  private _pendingOptions: TransitionOptions | null = null;
  private _transitioning: boolean = false;

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

  /** Immediately load a scene (no transition). */
  load(name: string): Scene {
    const factory = this._registry.get(name);
    if (factory === undefined) {
      throw new Error(`SceneManager: no scene registered as "${name}"`);
    }
    this._active?.stop();
    this._active = factory();
    this._active.start();
    return this._active;
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
  }

  private _elapsed: number = 0;

  queue(name: string): void {
    this._pending = name;
  }

  update(deltaTime: number): void {
    this._active?.update(deltaTime);

    if (this._pending !== null && this._transitioning) {
      const duration = this._pendingOptions?.duration ?? 0.3;
      this._elapsed += deltaTime;
      if (this._elapsed >= duration) {
        this._completeTransition();
      }
    } else if (this._pending !== null && !this._transitioning) {
      this._completeTransition();
    }
  }

  private _completeTransition(): void {
    if (this._pending === null) return;
    this.load(this._pending);
    this._pending = null;
    this._pendingOptions = null;
    this._transitioning = false;
    this._elapsed = 0;
  }
}

export const SceneManagerInstance = new SceneManager();

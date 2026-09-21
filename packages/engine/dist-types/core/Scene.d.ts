import { Entity } from "./Entity.js";
import { Engine } from "./EngineAPI.js";
import { UISystem } from "../systems/UISystem.js";
import { SystemManager } from "./SystemManager.js";
import type { ComponentType } from "./Component.js";
export type SystemFn = (scene: Scene, deltaTime: number) => void;
export declare class Scene {
  readonly name: string;
  backgroundColor: number;
  /** Per-scene UI system. Add widgets here; cleared automatically on destroy. */
  readonly ui: UISystem;
  private readonly _entities;
  /**
   * The scene's system registry. `addSystem()`/`removeSystem()` are sugar
   * over this — there is one system-collection concept in the engine
   * (`SystemManager`), and every scene owns one. Reach for `this.systems`
   * directly only if you need `SystemManager`'s `get()` lookup.
   */
  readonly systems: SystemManager;
  private _running;
  constructor(name: string);
  /** Access engine-level operations (scene stack, error logging, debug API). */
  get engine(): typeof Engine;
  /**
   * Called once before the scene begins updating. May be async — awaited by
   * SceneManager before the first update() tick.
   */
  onLoad(): Promise<void>;
  /**
   * Called once after `onLoad` resolves, just before the first frame.
   * Use for work that must run after all assets are ready but is synchronous.
   */
  onStart(): void;
  /**
   * Called every frame while the scene is running. Must be synchronous.
   * Use coroutines for multi-frame work.
   */
  onUpdate(_dt: number): void;
  /**
   * Called every physics tick (fixed 1/60 s by default) while the scene is
   * running. Use for velocity, force, and physics state reads.
   */
  onFixedUpdate(_dt: number): void;
  /**
   * Called when the scene is removed from the stack or replaced. Cancel timers,
   * audio, and external subscriptions here.
   */
  onDestroy(): void;
  /**
   * Called when another scene is pushed on top of this one (scene is now
   * paused beneath an overlay). Stop movement / AI here.
   */
  onPause(): void;
  /**
   * Called when the overlay above this scene is popped and this scene
   * becomes active again.
   */
  onResume(): void;
  createEntity(name?: string): Entity;
  addEntity(entity: Entity): Entity;
  private _track;
  removeEntity(entity: Entity): boolean;
  getEntity(id: number): Entity | undefined;
  /** Find an entity by name. Returns the first match, or undefined. */
  getEntityByName(name: string): Entity | undefined;
  getEntitiesByTag(tag: string): Entity[];
  /**
   * Return all entities that have the given component type string attached.
   * The type string must match the `Component.type` field exactly — it is not
   * derived from a constructor name (which is unsafe under minification).
   */
  getEntitiesWithComponent(type: ComponentType | string): Entity[];
  getEntities(): ReadonlyMap<number, Entity>;
  addSystem(name: string, fn: SystemFn): void;
  removeSystem(name: string): boolean;
  get isRunning(): boolean;
  update(deltaTime: number): void;
}

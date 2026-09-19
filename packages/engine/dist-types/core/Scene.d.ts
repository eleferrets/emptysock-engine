import { Entity } from "./Entity.js";
import { Engine } from "./EngineAPI.js";
import { UISystem } from "../systems/UISystem.js";
import type { Component } from "./Component.js";
export type SystemFn = (scene: Scene, deltaTime: number) => void;
export declare class Scene {
  readonly name: string;
  backgroundColor: number;
  /** Per-scene UI system. Add widgets here; cleared automatically on destroy. */
  readonly ui: UISystem;
  private readonly _entities;
  private readonly _systems;
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
  removeEntity(entity: Entity): boolean;
  getEntity(id: number): Entity | undefined;
  /** Find an entity by name. Returns the first match, or undefined. */
  getEntityByName(name: string): Entity | undefined;
  getEntitiesByTag(tag: string): Entity[];
  /** Return all entities that have the given component type string attached. */
  getEntitiesWithComponent(
    type: string | (new (...args: unknown[]) => Component),
  ): Entity[];
  getEntities(): ReadonlyMap<number, Entity>;
  addSystem(name: string, fn: SystemFn): void;
  removeSystem(name: string): boolean;
  get isRunning(): boolean;
  update(deltaTime: number): void;
}

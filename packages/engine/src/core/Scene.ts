import { Entity } from "./Entity.js";
import { Engine } from "./EngineAPI.js";
import { UISystem } from "../systems/UISystem.js";
import type { Component } from "./Component.js";

export type SystemFn = (scene: Scene, deltaTime: number) => void;

export class Scene {
  public readonly name: string;
  public backgroundColor: number = 0x1a1a2e;
  /** Per-scene UI system. Add widgets here; cleared automatically on destroy. */
  public readonly ui: UISystem = new UISystem();
  private readonly _entities: Map<number, Entity> = new Map();
  private readonly _systems: Array<{ name: string; fn: SystemFn }> = [];
  private _running: boolean = false;

  constructor(name: string) {
    this.name = name;
  }

  /** Access engine-level operations (scene stack, error logging, debug API). */
  get engine(): typeof Engine {
    return Engine;
  }

  // ─── Lifecycle hooks (override in subclasses) ────────────────────────────────

  /**
   * Called once before the scene begins updating. May be async — awaited by
   * SceneManager before the first update() tick.
   */
  async onLoad(): Promise<void> {}

  /**
   * Called once after `onLoad` resolves, just before the first frame.
   * Use for work that must run after all assets are ready but is synchronous.
   */
  onStart(): void {}

  /**
   * Called every frame while the scene is running. Must be synchronous.
   * Use coroutines for multi-frame work.
   */
  onUpdate(_dt: number): void {}

  /**
   * Called every physics tick (fixed 1/60 s by default) while the scene is
   * running. Use for velocity, force, and physics state reads.
   */
  onFixedUpdate(_dt: number): void {}

  /**
   * Called when the scene is removed from the stack or replaced. Cancel timers,
   * audio, and external subscriptions here.
   */
  onDestroy(): void {}

  /**
   * Called when another scene is pushed on top of this one (scene is now
   * paused beneath an overlay). Stop movement / AI here.
   */
  onPause(): void {}

  /**
   * Called when the overlay above this scene is popped and this scene
   * becomes active again.
   */
  onResume(): void {}

  // ─── Entities ────────────────────────────────────────────────────────────────

  createEntity(name?: string): Entity {
    const entity = new Entity(name);
    this._entities.set(entity.id, entity);
    // Auto-remove from scene registry when entity.destroy() is called
    entity.once("destroy", () => {
      this._entities.delete(entity.id);
    });
    return entity;
  }

  addEntity(entity: Entity): Entity {
    this._entities.set(entity.id, entity);
    entity.once("destroy", () => {
      this._entities.delete(entity.id);
    });
    return entity;
  }

  removeEntity(entity: Entity): boolean {
    return this._entities.delete(entity.id);
  }

  getEntity(id: number): Entity | undefined {
    return this._entities.get(id);
  }

  /** Find an entity by name. Returns the first match, or undefined. */
  getEntityByName(name: string): Entity | undefined {
    for (const e of this._entities.values()) {
      if (e.name === name) return e;
    }
    return undefined;
  }

  getEntitiesByTag(tag: string): Entity[] {
    return Array.from(this._entities.values()).filter((e) => e.hasTag(tag));
  }

  /** Return all entities that have the given component type string attached. */
  getEntitiesWithComponent(
    type: string | (new (...args: unknown[]) => Component),
  ): Entity[] {
    const typeStr =
      typeof type === "string"
        ? type
        : ((type as unknown as { type?: string }).type ?? type.name);
    return Array.from(this._entities.values()).filter((e) =>
      e.hasComponent(typeStr),
    );
  }

  getEntities(): ReadonlyMap<number, Entity> {
    return this._entities;
  }

  // ─── Systems ─────────────────────────────────────────────────────────────────

  addSystem(name: string, fn: SystemFn): void {
    this._systems.push({ name, fn });
  }

  removeSystem(name: string): boolean {
    const idx = this._systems.findIndex((s) => s.name === name);
    if (idx === -1) return false;
    this._systems.splice(idx, 1);
    return true;
  }

  // ─── Internal lifecycle (called by SceneManager) ────────────────────────────

  /** @internal */
  start(): void {
    this._running = true;
  }

  /** @internal */
  stop(): void {
    this._running = false;
  }

  get isRunning(): boolean {
    return this._running;
  }

  /** @internal — called by SceneManager once after onLoad resolves */
  _callOnStart(): void {
    this.onStart();
  }

  /** @internal — called by SceneManager when this scene is paused under an overlay */
  _callOnPause(): void {
    this.onPause();
  }

  /** @internal — called by SceneManager when this scene returns to the top */
  _callOnResume(): void {
    this.onResume();
  }

  update(deltaTime: number): void {
    if (!this._running) return;
    if (Engine.isDebugPaused()) return;

    // Only update root entities; child entities are updated recursively.
    for (const entity of this._entities.values()) {
      if (entity.parent === null) entity.update(deltaTime);
    }

    for (const system of this._systems) {
      system.fn(this, deltaTime);
    }

    this.onUpdate(deltaTime);
  }

  /** @internal — called by a fixed-timestep loop if one is wired up */
  fixedUpdate(deltaTime: number): void {
    if (!this._running) return;
    this.onFixedUpdate(deltaTime);
  }
}

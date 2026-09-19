import { Entity } from "./Entity.js";
import { Engine } from "./EngineAPI.js";
import { UISystem } from "../systems/UISystem.js";

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
   * Called once before the scene begins updating. May be async — await it
   * in SceneManager before the first update() tick. Do not start coroutines or
   * manipulate entities here; wait for onUpdate.
   */
  async onLoad(): Promise<void> {}

  /**
   * Called every frame while the scene is running. Must be synchronous — do
   * not declare this async. Use entity.startCoroutine() for multi-frame work.
   */
  onUpdate(_dt: number): void {}

  /**
   * Called when the scene is removed from the stack or replaced. Clean up
   * timers, audio, and any external subscriptions here.
   */
  onDestroy(): void {}

  // ─── Entities ────────────────────────────────────────────────────────────────

  createEntity(name?: string): Entity {
    const entity = new Entity(name);
    this._entities.set(entity.id, entity);
    return entity;
  }

  addEntity(entity: Entity): Entity {
    this._entities.set(entity.id, entity);
    return entity;
  }

  removeEntity(entity: Entity): boolean {
    return this._entities.delete(entity.id);
  }

  getEntity(id: number): Entity | undefined {
    return this._entities.get(id);
  }

  getEntitiesByTag(tag: string): Entity[] {
    return Array.from(this._entities.values()).filter((e) => e.hasTag(tag));
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

  update(deltaTime: number): void {
    if (!this._running) return;
    // Honour the IDE step debugger: freeze the loop while paused.
    if (Engine.isDebugPaused()) return;

    // Only update root entities; child entities are updated recursively by their parents.
    for (const entity of this._entities.values()) {
      if (entity.parent === null) entity.update(deltaTime);
    }

    // Run scene-level systems.
    for (const system of this._systems) {
      system.fn(this, deltaTime);
    }

    // Call the game-code hook.
    this.onUpdate(deltaTime);
  }
}

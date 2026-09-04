import { Entity } from './Entity.js';
import { Engine } from './EngineAPI.js';

export type SystemFn = (scene: Scene, deltaTime: number) => void;

export class Scene {
  public readonly name: string;
  public backgroundColor: number = 0x1a1a2e;
  private readonly _entities: Map<number, Entity> = new Map();
  private readonly _systems: Array<{ name: string; fn: SystemFn }> = [];
  private _running: boolean = false;

  constructor(name: string) {
    this.name = name;
  }

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
    return Array.from(this._entities.values()).filter(e => e.hasTag(tag));
  }

  getEntities(): ReadonlyMap<number, Entity> {
    return this._entities;
  }

  // ─── Systems ─────────────────────────────────────────────────────────────────

  addSystem(name: string, fn: SystemFn): void {
    this._systems.push({ name, fn });
  }

  removeSystem(name: string): boolean {
    const idx = this._systems.findIndex(s => s.name === name);
    if (idx === -1) return false;
    this._systems.splice(idx, 1);
    return true;
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  start(): void {
    this._running = true;
  }

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

    // Update entity components
    for (const entity of this._entities.values()) {
      entity.update(deltaTime);
    }

    // Run systems
    for (const system of this._systems) {
      system.fn(this, deltaTime);
    }
  }
}

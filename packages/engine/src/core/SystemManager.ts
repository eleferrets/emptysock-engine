export interface UpdatableSystem {
  update(dt: number): void;
  destroy?(): void;
}

/**
 * A utility for managing a named collection of systems and updating them in
 * registration order. This is a lower-level primitive than `Scene.addSystem()`.
 *
 * **Prefer `Scene.addSystem()`** in game code — it ties system lifetime to the
 * scene and ensures systems are destroyed when the scene unloads. Use
 * `SystemManager` directly only when you need a system collection that is
 * independent of any scene (e.g. a process-level manager or a custom runner).
 */
export class SystemManager {
  private readonly _systems: Map<string, UpdatableSystem> = new Map();

  register(name: string, system: UpdatableSystem): void {
    this._systems.set(name, system);
  }

  unregister(name: string): void {
    const system = this._systems.get(name);
    system?.destroy?.();
    this._systems.delete(name);
  }

  updateAll(dt: number): void {
    for (const system of this._systems.values()) {
      system.update(dt);
    }
  }

  get<T extends UpdatableSystem>(name: string): T | undefined {
    return this._systems.get(name) as T | undefined;
  }
}

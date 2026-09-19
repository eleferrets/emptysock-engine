export interface UpdatableSystem {
  update(dt: number): void;
  destroy?(): void;
}

/**
 * The engine's single system registry: a named collection of systems,
 * updated in registration order. `Scene.addSystem()` is a thin, scene-scoped
 * convenience wrapper over one of these — every `Scene` owns its own
 * `SystemManager` internally, so there is exactly one "collection of
 * systems" concept in the engine, not two.
 *
 * Construct a `SystemManager` directly only when you need a system
 * collection that outlives any single scene (a process-level manager, or a
 * custom runner that doesn't use `Scene` at all).
 */
export class SystemManager {
  private readonly _systems: Map<string, UpdatableSystem> = new Map();

  register(name: string, system: UpdatableSystem): void {
    this._systems.set(name, system);
  }

  /** Unregisters and destroys the system. Returns false if no system was registered under `name`. */
  unregister(name: string): boolean {
    const system = this._systems.get(name);
    if (system === undefined) return false;
    system.destroy?.();
    this._systems.delete(name);
    return true;
  }

  updateAll(dt: number): void {
    for (const system of this._systems.values()) {
      system.update(dt);
    }
  }

  get<T extends UpdatableSystem>(name: string): T | undefined {
    return this._systems.get(name) as T | undefined;
  }

  /** Destroys every registered system and clears the registry. */
  destroy(): void {
    for (const name of Array.from(this._systems.keys())) {
      this.unregister(name);
    }
  }
}

export interface UpdatableSystem {
  update(dt: number): void;
  destroy?(): void;
}

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

export interface UpdatableSystem {
  update(dt: number): void;
  destroy?(): void;
}
export declare class SystemManager {
  private readonly _systems;
  register(name: string, system: UpdatableSystem): void;
  unregister(name: string): void;
  updateAll(dt: number): void;
  get<T extends UpdatableSystem>(name: string): T | undefined;
}

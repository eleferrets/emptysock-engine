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
export declare class SystemManager {
  private readonly _systems;
  register(name: string, system: UpdatableSystem): void;
  /** Unregisters and destroys the system. Returns false if no system was registered under `name`. */
  unregister(name: string): boolean;
  updateAll(dt: number): void;
  get<T extends UpdatableSystem>(name: string): T | undefined;
  /** Destroys every registered system and clears the registry. */
  destroy(): void;
}

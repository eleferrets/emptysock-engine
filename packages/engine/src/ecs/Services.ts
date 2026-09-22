/**
 * ENGINE_DESIGN.md §5 — the typed, explicit replacement for Godot-style
 * autoloads. Same underlying idea as the `PluginSystem` singleton
 * (documented in `CLAUDE.md` under "PluginSystem singleton": process-global,
 * not per-scene, so a consumer never has to thread a reference through
 * scene boundaries), generalized so save data, audio mixing state, input
 * remapping, and third-party plugins are all "services", one mechanism
 * instead of several ad hoc singletons.
 *
 * Unlike `pluginSystem`, this is not a module-level singleton — it is one
 * instance per `Game` (`game.services`), constructed once in `Game`'s
 * constructor and never recreated by `loadScene`/`unloadScene`, so it
 * survives scene transitions for the lifetime of that `Game` instance.
 */

/** Any zero-argument constructible class — what `register`/`get` key on. */
export type ServiceConstructor<T> = new () => T;

/**
 * ```ts
 * class ScoreService {
 *   score = 0;
 *   add(n: number) { this.score += n; }
 * }
 *
 * game.services.register(ScoreService);
 * const score = game.services.get(ScoreService); // typed as ScoreService
 * score.add(10);
 * ```
 */
export class ServiceRegistry {
  private readonly _instances = new Map<ServiceConstructor<unknown>, unknown>();

  /**
   * Construct and store one instance, keyed by the class itself (not a
   * string name — no typo-prone lookups, no ambiguity between two classes
   * that happen to share a name). Re-registering the same class is a no-op
   * that returns the existing instance and logs a warning, rather than
   * silently replacing state other code may already be holding a reference
   * into.
   */
  register<T>(ctor: ServiceConstructor<T>): T {
    const existing = this._instances.get(ctor);
    if (existing !== undefined) {
      console.warn(
        `[ServiceRegistry] "${ctor.name}" is already registered — returning the existing instance.`,
      );
      return existing as T;
    }
    const instance = new ctor();
    this._instances.set(ctor, instance);
    return instance;
  }

  /**
   * Retrieve a previously-registered instance with a real type, no casting
   * needed at the call site. Throws if `ctor` was never registered — a
   * missing service is a wiring bug, not a value a caller should have to
   * null-check every time.
   */
  get<T>(ctor: ServiceConstructor<T>): T {
    const instance = this._instances.get(ctor);
    if (instance === undefined) {
      throw new Error(
        `[ServiceRegistry] "${ctor.name}" is not registered. Call game.services.register(${ctor.name}) first.`,
      );
    }
    return instance as T;
  }

  /** `true` if `ctor` has been registered. */
  has<T>(ctor: ServiceConstructor<T>): boolean {
    return this._instances.has(ctor);
  }

  /** Drop a registered instance. Mainly useful for tests. */
  unregister<T>(ctor: ServiceConstructor<T>): void {
    this._instances.delete(ctor);
  }
}

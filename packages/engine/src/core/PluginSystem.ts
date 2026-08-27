export interface PluginContext {
  /** Expose a named service so other plugins and game code can retrieve it. */
  provide<T>(key: string, value: T): void;
  /** Retrieve a service registered by another plugin. */
  inject<T>(key: string): T | undefined;
}

export interface Plugin {
  readonly name: string;
  readonly version?: string;
  /** Called when the plugin is registered. May be async. */
  install(ctx: PluginContext): void | Promise<void>;
  /** Optional teardown called by unregister(). */
  uninstall?(): void | Promise<void>;
}

export class PluginSystem {
  private readonly _plugins: Map<string, Plugin> = new Map();
  private readonly _services: Map<string, unknown> = new Map();

  private readonly _ctx: PluginContext = {
    provide: <T>(key: string, value: T) => { this._services.set(key, value); },
    inject: <T>(key: string): T | undefined => this._services.get(key) as T | undefined,
  };

  async register(plugin: Plugin): Promise<void> {
    if (this._plugins.has(plugin.name)) {
      console.warn(`[PluginSystem] "${plugin.name}" already registered — skipping.`);
      return;
    }
    this._plugins.set(plugin.name, plugin);
    await plugin.install(this._ctx);
  }

  async unregister(name: string): Promise<void> {
    const plugin = this._plugins.get(name);
    if (plugin === undefined) return;
    await plugin.uninstall?.();
    this._plugins.delete(name);
  }

  inject<T>(key: string): T | undefined {
    return this._services.get(key) as T | undefined;
  }

  get registeredPlugins(): ReadonlyArray<string> {
    return [...this._plugins.keys()];
  }
}

/** Global singleton — import and use directly in game code. */
export const pluginSystem = new PluginSystem();

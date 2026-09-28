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
export declare class PluginSystem {
  private readonly _plugins;
  private readonly _services;
  private readonly _ctx;
  register(plugin: Plugin): Promise<void>;
  unregister(name: string): Promise<void>;
  inject<T>(key: string): T | undefined;
  get registeredPlugins(): ReadonlyArray<string>;
}
//# sourceMappingURL=PluginSystem.d.ts.map

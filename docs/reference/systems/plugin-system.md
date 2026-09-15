# PluginSystem

`PluginSystem` is a module-level singleton service locator for optional, process-global capabilities. Register a plugin once at application startup; inject it from anywhere.

For a task-oriented introduction, see the [Plugins guide](../../guides/plugins.md).

Import: `import { pluginSystem, type Plugin, type PluginContext } from '@emptysock/engine';`

Note: `pluginSystem` (lowercase `p`) is the singleton instance. `PluginSystem` (uppercase) is the class — you do not construct it.

---

## Why a singleton

Plugins are process-global — an analytics SDK, ads library, or platform achievement system exists once for the lifetime of the app, not per scene. Constructing a new PluginSystem per scene would require all consumers to hold a reference to the right instance. The singleton makes `inject()` callable from anywhere without dependency injection.

---

## `pluginSystem.register(plugin: Plugin): Promise<void>`

Install a plugin. Calls `plugin.install(ctx)`, which may be async. Throws if a plugin with the same `name` is already registered.

```typescript
await pluginSystem.register(myPlugin);
```

---

## `pluginSystem.inject<T>(key: string): T | undefined`

Retrieve a service registered by a plugin. Returns `undefined` if the key is not found — always use optional chaining.

```typescript
const svc = pluginSystem.inject<MyService>("myService");
svc?.doSomething();
```

---

## `pluginSystem.unregister(name: string): Promise<void>`

Remove a plugin by name. Calls `plugin.uninstall()`. Does nothing if the plugin is not registered.

```typescript
await pluginSystem.unregister("my-plugin");
```

---

## Plugin interface

```typescript
interface Plugin {
  name: string;
  version: string;
  install(ctx: PluginContext): void | Promise<void>;
  uninstall(): void | Promise<void>;
}
```

### PluginContext

The `ctx` argument passed to `install` gives the plugin a way to provide services:

```typescript
interface PluginContext {
  provide(key: string, service: unknown): void;
}
```

---

## Writing a plugin

```typescript
import {
  pluginSystem,
  type Plugin,
  type PluginContext,
} from "@emptysock/engine";

class AnalyticsService {
  track(event: string): void {
    // send to analytics backend
  }
}

const analyticsPlugin: Plugin = {
  name: "analytics",
  version: "1.0.0",

  install(ctx: PluginContext): void {
    ctx.provide("analytics", new AnalyticsService());
  },

  uninstall(): void {
    // cleanup connections if needed
  },
};

// Register once, at app startup (not per scene):
await pluginSystem.register(analyticsPlugin);
```

---

## Injecting from game code

```typescript
import { pluginSystem } from "@emptysock/engine";

// Inside any scene or actor:
const analytics = pluginSystem.inject<AnalyticsService>("analytics");
analytics?.track("level_complete");
```

---

## Rules

- **Register at app startup**, not inside `onLoad`. Plugins outlive scenes.
- **Never construct a new PluginSystem.** Use the exported `pluginSystem` singleton.
- `install()` may be async — always `await pluginSystem.register()`.
- `inject()` returns `undefined` if the key was never provided — never cast the return value.

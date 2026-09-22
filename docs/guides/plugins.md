# Plugins

The **PluginSystem** is a lightweight service locator for optional capabilities: analytics, ads SDKs, platform achievements, leaderboards, and similar process-global integrations.

For the complete API, see [PluginSystem reference](../reference/systems/plugin-system.md).

> **Heads up:** `PluginSystem` stays a bare module-level singleton on purpose, it's for things that are genuinely global to the whole running app. If what you actually want is shared state scoped to one `Game` instance (score, settings, that kind of thing), `@emptysock/engine/v2` has a typed, class-keyed `ServiceRegistry` (`game.services`) for that instead. See the [Core API reference](../reference/core-api.md).

---

## Why plugins?

Plugins solve an import-time coupling problem. If your game conditionally includes an analytics SDK, you don't want to import it from every scene that might use it. `PluginSystem` lets you register an implementation once and retrieve it by name from anywhere, with no direct import required.

The `pluginSystem` export is a **module-level singleton**. Plugins are registered once for the lifetime of the process, not per-scene. This is intentional: an analytics SDK, an ads library, or a platform achievement system exists once for the lifetime of the app. Do not construct a new `PluginSystem` per scene.

---

## Writing a plugin

A plugin is a plain object with a `name`, a `version`, an `install` method, and an optional `uninstall` method:

```typescript
import { type Plugin, type PluginContext } from "@emptysock/engine";

class MyAnalyticsService {
  track(event: string): void {
    console.log("Analytics:", event);
  }
}

const analyticsPlugin: Plugin = {
  name: "analytics",
  version: "1.0.0",

  install(ctx: PluginContext): void {
    ctx.provide("analytics", new MyAnalyticsService());
  },

  uninstall(): void {
    // Clean up SDK resources if needed.
  },
};
```

`install()` may be async. `ctx.provide(key, value)` registers a service under a string key.

---

## Registering a plugin

Register plugins at application startup — typically before your first scene loads:

```typescript
import { pluginSystem } from "@emptysock/engine";

await pluginSystem.register(analyticsPlugin);
```

Registering a duplicate name throws. Check `pluginSystem.has('analytics')` if you need to guard against double-registration.

---

## Using an injected service

```typescript
import { pluginSystem } from "@emptysock/engine";

// In any scene or game logic:
const analytics = pluginSystem.inject<MyAnalyticsService>("analytics");
analytics?.track("level-start");
```

`inject()` returns `undefined` if the key is not registered. Use optional chaining (`?.`) rather than asserting the value is present — this keeps the code safe when the plugin is absent (e.g. in tests or in a build variant that omits the SDK).

---

## Unregistering a plugin

```typescript
await pluginSystem.unregister("analytics");
```

This calls `uninstall()` on the plugin and removes the registered services.

---

## Tips

- Register all plugins before calling `SceneManager.load()`. Plugins registered after the first scene starts will not be available during that scene's `onLoad`.
- Avoid `pluginSystem.inject()` inside tight loops. Cache the result in a variable.
- For testing, register a mock plugin implementation before the test and unregister it in teardown.

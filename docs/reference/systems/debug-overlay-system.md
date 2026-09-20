# DebugOverlaySystem

`DebugOverlaySystem` is a shippable in-game debug overlay: FPS/frame-time, entity count, and a scrollable console that captures log lines and dispatches developer-registered commands. It renders through the existing `PanelWidget`/`LabelWidget` UI tree, so it works identically in Node (tests), the browser preview, and the Tauri WebView. It is disabled by default — enable it behind your own dev flag.

Import: `import { DebugOverlaySystem } from '@emptysock/engine';`

---

## Basic usage

```typescript
import { DebugOverlaySystem } from "@emptysock/engine";

const overlay = new DebugOverlaySystem();
if (isDevBuild) overlay.enable();

scene.ui.add(overlay.root); // place on top of your other UI, e.g. LAYER.UI

function onUpdate(dt: number) {
  overlay.update(dt, scene.entities.length);
}
```

## Console commands

```typescript
overlay.registerCommand("spawn", (args) => {
  const kind = args[0] ?? "goblin";
  spawnEnemy(kind);
  return `spawned ${kind}`;
});

overlay.runCommand("spawn goblin"); // -> "spawned goblin"
```

`help` and `clear` are registered by default. `unregisterCommand(name)` removes one.

## Logging

```typescript
overlay.log("checkpoint reached");
overlay.warn("low fps");
overlay.logError("uncaught exception in onUpdate"); // wire this to Engine.logError
```

`overlay.history` returns the last 200 entries. The console label shows the most recent 8 lines.

## API summary

- `enable()` / `disable()` / `toggle()` / `enabled: boolean`
- `update(dt: number, entityCount: number): void` — call once per frame
- `root: PanelWidget` — add to a scene's `UISystem`
- `registerCommand(name, handler)` / `unregisterCommand(name)` / `runCommand(line)` / `commandNames`
- `log(message)` / `warn(message)` / `logError(message)` / `history`

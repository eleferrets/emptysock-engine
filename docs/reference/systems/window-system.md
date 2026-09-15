# WindowSystem

`WindowSystem` exposes window and display management for the desktop (Tauri) build. In browser mode, calls are no-ops or return sensible defaults.

Import: `import { WindowSystem } from '@emptysock/engine';`

---

## Tauri detection

Window features are only available when the game is running inside Tauri. Check before calling window-specific APIs:

```typescript
if ("__TAURI_INTERNALS__" in window) {
  WindowSystem.setFullscreen(true);
}
```

Never use build-time detection flags — the engine ships a single bundle that runs in both browser and desktop contexts.

---

## `WindowSystem.setFullscreen(value: boolean): Promise<void>`

Enter or exit fullscreen mode. No-op in browser mode.

```typescript
await WindowSystem.setFullscreen(true);
await WindowSystem.setFullscreen(false);
```

---

## `WindowSystem.isFullscreen(): Promise<boolean>`

Returns whether the window is currently fullscreen. Returns `false` in browser mode.

```typescript
const full = await WindowSystem.isFullscreen();
```

---

## `WindowSystem.setTitle(title: string): Promise<void>`

Set the window title bar text. No-op in browser mode.

```typescript
await WindowSystem.setTitle("My Game — Level 3");
```

---

## `WindowSystem.setSize(width: number, height: number): Promise<void>`

Resize the window. No-op in browser mode.

```typescript
await WindowSystem.setSize(1280, 720);
```

---

## `WindowSystem.center(): Promise<void>`

Center the window on the screen. No-op in browser mode.

```typescript
await WindowSystem.center();
```

---

## Tips

- All `WindowSystem` calls are async — they forward to Tauri IPC and the OS window manager.
- Wrap calls in the `'__TAURI_INTERNALS__' in window` guard so the same code works in both browser preview and desktop packaging.
- Fullscreen transitions can take a frame or two. Don't read `isFullscreen()` immediately after `setFullscreen()` — await the promise, then read.

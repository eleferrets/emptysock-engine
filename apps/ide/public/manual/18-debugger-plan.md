# 18 — Debugger Plan

This section describes how a step-debugger could be integrated into the EmptySock IDE.

---

## What a step-debugger would look like

The IDE currently surfaces runtime errors through the ConsolePanel. A proper step-debugger would add:

- **Frame counter** — the current game-loop frame number, updated each tick.
- **Entity inspector** — a live read-out of every active entity's components and their values at the end of the most recent frame.
- **Error surface** — the most-recent uncaught error with its full stack trace, formatted and linkable to the Monaco editor.
- **Pause / step** controls — the ability to pause the game loop, advance one frame at a time, and resume.

---

## Option A — postMessage event panel (recommended for all platforms)

The game runs inside a sandboxed `<iframe>` in the IDE preview pane. The parent window and the iframe can exchange messages via `window.postMessage`.

**How it works:**

1. A small shim is injected into the game bundle at build time (debug mode only). The shim:
   - Wraps `requestAnimationFrame` to count frames.
   - Installs a global `unhandledrejection` / `error` listener that captures stack traces.
   - After every frame, posts a structured message to `window.parent`:
     ```ts
     window.parent.postMessage(
       {
         type: "es:frame",
         frame: frameNumber,
         entities: snapshot, // array of { id, name, components }
         error: errorPayload, // null or { message, stack }
       },
       "*",
     );
     ```
2. ConsolePanel (or a dedicated DebugPanel tab) listens with a `message` event handler and renders the incoming data.
3. Pause/step is implemented by posting a command back into the iframe:
   ```ts
   iframeRef.current.contentWindow?.postMessage({ type: "es:pause" }, "*");
   iframeRef.current.contentWindow?.postMessage({ type: "es:step" }, "*");
   ```
   The shim inside the iframe honours these commands by gating `requestAnimationFrame`.

**Advantages:**

- Works in the browser preview and in the Tauri WebView without any native permissions.
- No extra build tooling or native APIs.
- The shim adds zero overhead in release builds (stripped by esbuild dead-code elimination when `DEBUG` is `false`).

**Limitations:**

- Snapshot fidelity is limited to what can be serialised through `postMessage` (no circular references, no class instances — only plain objects).
- Setting breakpoints inside the game code requires a separate mechanism (see Option B).

---

## Option B — Chrome DevTools Protocol bridge via Tauri

Tauri's WebView exposes a CDP (Chrome DevTools Protocol) endpoint when launched with the `--inspect` flag on supported platforms (macOS, Linux, Windows with the Chromium backend).

**How it would work:**

1. The Tauri shell launches its WebView with CDP enabled.
2. The IDE backend (a Tauri command) opens a WebSocket to `ws://127.0.0.1:<cdp-port>/json` and relays CDP messages to the frontend via Tauri events.
3. The IDE frontend implements a CDP client, sending `Debugger.enable`, `Debugger.setBreakpoint`, and `Debugger.stepOver` commands.
4. CDP pause events are forwarded to the IDE, which highlights the current source location in the Monaco editor.

**Advantages:**

- Full breakpoint support with local variable inspection, call-stack navigation, and watch expressions.
- Works with the existing V8 runtime — no game-code changes needed.

**Limitations:**

- Requires Tauri (not available in the PWA/browser build).
- CDP port discovery is platform-specific and may require additional native permissions.
- Adds significant implementation complexity (a CDP state machine in the frontend).

---

## Recommended path

**Phase 1 — Option A.** Implement the postMessage shim and a DebugPanel tab in the IDE. This gives frame counters, entity snapshots, and error surfaces on all platforms with minimal complexity.

**Phase 2 — Option B.** Once Phase 1 is stable, layer the CDP bridge on top for Tauri builds. Gate it behind a runtime check (`'__TAURI_INTERNALS__' in window`) so the browser build continues to use Phase 1.

---

## Data exposed by Phase 1

| Field           | Description                                                                        |
| --------------- | ---------------------------------------------------------------------------------- |
| `frame`         | Current game-loop frame number (integer, increments each `requestAnimationFrame`). |
| `entities`      | Array of `{ id, name, components: string[] }` snapshots from the live scene.       |
| `error.message` | The error message from the most-recent uncaught exception or unhandled rejection.  |
| `error.stack`   | V8 stack trace string, trimmed to 10 frames.                                       |

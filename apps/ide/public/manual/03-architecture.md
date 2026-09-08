# 3 — Architecture Overview

Understanding how the pieces fit together prevents mistakes that are difficult to debug later.

---

## The theater analogy

Think of EmptySock like putting on a play:

- The **Scene** is the stage. It runs the show. There is one active stage at a time.
- **Entities** are the actors. Each one has a name and a place on stage, but on its own an actor does nothing — it needs costumes and props.
- **Components** are the costumes and props. A `Sprite` gives an entity a visual appearance. A `PhysicsBody` gives it weight and collision. Components are what make an entity actually do something.
- **Systems** are the stage crew. The `RenderSystem` draws everything. The `PhysicsSystem` moves bodies. The `InputSystem` watches the keyboard. Systems run every frame and operate on components.
- The **Actor Model** is the backstage radio. Actors (a different concept, see Section 3.4) communicate through messages — they do not grab each other's scripts directly.

---

## 3.1 The three-layer model

```
┌──────────────────────────────────────────────────────┐
│  apps/ide   (Tauri + React)                          │
│  — visual editing, Monaco editor, build pipeline     │
├──────────────────────────────────────────────────────┤
│  packages/engine   (@emptysock/engine)               │
│  — Scene, Entity, Component, all Systems             │
├──────────────────────────────────────────────────────┤
│  packages/types    (@emptysock/types)                │
│  — shared interfaces, no implementation              │
└──────────────────────────────────────────────────────┘
```

The engine is **environment-agnostic**: it does not import DOM APIs, Tauri APIs, or browser-only globals. It runs identically in Node (tests), the browser sandbox (IDE preview), and the Tauri WebView (desktop). This constraint is enforced by package boundary — the engine cannot see `apps/ide`.

> **Tip:** If you ever get a runtime error that says a DOM API (like `document` or `window`) is not defined during tests, you accidentally imported something from the IDE layer into the engine. Check your import paths.

---

## 3.2 Scene lifecycle

A **Scene** owns the complete state of one "screen" of the game — the main menu, a level, a cutscene. The engine runs exactly one active scene at a time (plus optional overlay scenes pushed onto the scene stack).

```
onLoad() ─async─► (first frame) ─► onUpdate(dt) ─► ... ─► onDestroy()
```

- **`onLoad`** is awaited before the first frame. Load assets, build entities, await async systems (`PhysicsSystem3D.init()`) here.
- **`onUpdate(dt)`** runs every frame. `dt` is wall-clock seconds since the last frame (capped internally to prevent spiral-of-death on tab suspend). Never `await` inside `onUpdate` — use coroutines instead.
- **`onDestroy`** runs when the scene is unloaded. Cancel every timer handle. Call `physics.destroy()` to free Rapier WASM memory.

---

## 3.3 Entity-Component System (ECS)

**ECS** (Entity-Component System) is a design pattern where game objects (entities) are just containers, and their behaviors come from attached data objects (components). The name comes from the three parts:

- **Entity** — a named container with a unique ID. No logic of its own.
- **Component** — a typed data + behavior object. `Sprite`, `PhysicsBody`, `Animator`, `Health` are all components.
- **System** — code that reads and modifies components every frame. `RenderSystem` reads `Sprite` components to draw them.

EmptySock uses a **sparse ECS**: entities are plain ID containers, components are typed data+behaviour objects. There is no archetype storage — the pattern favours clarity over raw cache efficiency, which suits games with hundreds to low-thousands of entities.

```
Scene
 └── Entity('Player')
      ├── Sprite       { texture, anchor, scale }
      ├── PhysicsBody  { shape, bodyType }
      ├── Animator     { clips, currentClip }
      └── CharacterController { slopeAngle }
```

Components do not have their own `update()`. Game logic that reads and mutates component state lives in the **scene's `onUpdate`** or in **Actor `receive()`/`update()`**.

This separation keeps component data inspectable (the Inspector panel reads `entity.components`) and keeps update order explicit.

---

## 3.4 Actor Model

The **Actor Model** is the concurrency and decoupling primitive. In theaters terms: actors communicate by passing notes, never by grabbing each other's scripts.

An actor is a self-contained unit with:
- A private mailbox (`_inbox: Message[]`)
- A `receive(msg)` method — the only way its state changes from outside
- An `update(dt)` method for frame-tick work

Actors **never read each other's fields directly**. All communication is via `ActorSystem.send(id, msg)` or `broadcast(msg)`. This makes the interaction graph explicit and testable.

```
ActorSystem.send('enemy-1', { type: 'TAKE_DAMAGE', amount: 10 })
     │
     ▼  (queued in enemy-1._inbox)
ActorSystem.update(dt)
     │
     └─► enemy-1.flush()   ─►  enemy-1.receive({ type: 'TAKE_DAMAGE', amount: 10 })
     └─► enemy-1.update(dt)
```

The flush-then-update order guarantees that all messages sent in frame N are processed before any actor runs its frame-N update.

For multiplayer, `NetworkActor` extends `Actor` with a pluggable `Transport` interface. Remote messages arrive through the transport and are routed into the same `receive()` method — the actor cannot tell whether a message came from local code or over the network.

> **Tip:** The Actor Model is optional. Small games can put all logic in `onUpdate()`. Reach for actors when you need clear communication channels between independent game systems, or when you want to test logic in isolation.

---

## 3.5 Plugin system

The **PluginSystem** is a lightweight service locator for optional capabilities (analytics, ads SDK, platform achievements, etc.). A plugin installs itself by calling `ctx.provide('key', implementation)`. Any code can later retrieve it via `pluginSystem.inject<T>('key')`.

This avoids import-time coupling between optional services and the game code that uses them. The `pluginSystem` export is a module-level singleton — plugins are registered once for the lifetime of the app, not per scene.

---

## 3.6 IDE data flow

```
User edits code in Monaco
        │
        ▼
  ideStore.setFileContent(path, code)
        │
        ▼
  GameBuildService.buildNow({ virtualFiles: openFiles })
        │  (esbuild-wasm, in-browser, multi-file virtual FS)
        ▼
  Blob URL injected into <iframe>
        │
        ▼
  iframe postMessages: fps, log, error, ready
        │
        ├─► Console panel
        ├─► Profiler panel
        └─► Play state
```

The IDE's Zustand store (`useIDEStore`) is the single source of truth for all editor state. No panel reads from another panel directly — they all read from and write to the store.

---

## 3.7 Layout system

The IDE uses **rc-dock** for its panel layout. Every panel is a tab inside a `DockLayout`. Users can drag tabs to rearrange, split, or float them. The default layout is defined as a `LayoutData` tree in `App.tsx` and never changes at startup — user rearrangements live in rc-dock's internal state.

To add a new panel: create a component, import it in `App.tsx`, add a `makeTab` entry to `DEFAULT_LAYOUT`. That is the entire integration.

---

## 3.8 Build pipeline

```
TypeScript sources (virtualFiles map)
        │
        ▼
  engineGlobalPlugin  — resolves @emptysock/engine to window.__engine__ UMD global
  virtualFsPlugin     — resolves ./relative imports from the open-files map
        │
        ▼
  esbuild-wasm (browser, no filesystem access)
        │
        ▼
  IIFE bundle string
        │
        ▼
  Blob URL → iframe srcdoc
```

The engine itself is pre-bundled as a UMD global in the iframe's context. User code is compiled separately and imports the engine via that global, keeping rebuild times under 200 ms even for large projects.

> **Tip:** If esbuild reports a missing import, check that the file with the broken import is in the IDE's open-files panel. Files that exist on disk but are not open in the IDE are not included in the virtual filesystem at build time.

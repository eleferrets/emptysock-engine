### Engine environment boundary

The engine package must not import anything from the DOM, from Tauri APIs, or from `apps/ide`. The reason is that the same compiled engine bundle runs in three contexts: Node.js (Vitest), the browser preview iframe (IDE), and the Tauri WebView (desktop). An import of a DOM-only API causes silent runtime failures in Node, not a compile error. Enforce this by reviewing any new engine import: no DOM, no Tauri, nothing from `apps/ide`. Third-party libraries are allowed only when justified by a one-line entry here, so a new dependency means a new line in this list (reviewed for Node/browser/WebView safety). Current dependencies of `packages/engine`:

- `pixi.js`: the 2D renderer (sprites, filters, text); runs headless under mocks and on WebGL/WebGPU in the browser and WebView.
- `pixi-filters`: maintained stock filters (`ColorOverlayFilter`, `OutlineFilter`, `SimpleLightmapFilter`) instead of hand-written shaders.
- `yoga-layout`: flexbox layout for the UI system, a spec-accurate engine we should not reimplement.
- `bitecs`: the ECS storage core behind `Scene`/`Entity`/`Component`.
- Also present, outside the four above: `@dimforge/rapier2d-compat` and `rapier3d-compat` (physics), `howler` (audio playback), `zod` (schema validation for scene, save and asset-index files). Each is a maintained library that beats a hand-rolled version.

### Actor mailbox ordering

`ActorSystem` drains every actor's inbox before calling `update()` on any actor. This means all messages sent during frame N are fully processed before frame N's update() logic runs on any actor. A consequence: messages sent inside an actor's `receive()` are processed in the same flush pass, not deferred to the next frame. If you add a message loop that causes an actor to send back to itself, the flush will run until the inbox is empty — an infinite loop if the actor always re-enqueues.

### Transport and StorageAdapter are interfaces, not classes

`SaveSystem` takes a `StorageAdapter` (`get`/`set`/`delete`/`listKeys`) rather than talking to IndexedDB or a filesystem directly — the engine defines the interface, the host (browser preview shell, Tauri desktop shell) builds and injects the concrete adapter. With no adapter given, `SaveSystem` defaults to `MemoryStorageAdapter` (an in-process `Map`, nothing persisted across restarts), which is what makes it usable out of the box under the headless testing harness and any other Node context. The same "engine defines the interface, whoever has a live instance wires the concrete implementation" pattern shows up again for `QueryChannel` (see below) and would apply to any future networking transport — the engine ships no concrete WebSocket/WebRTC implementation; that belongs in `@emptysock/network` or game code.

### `PluginSystem`, `VariableStore`, `LocalisationSystem`, `ViewportSystem`, and `WindowSystem` are `Game` services, not module-level singletons

Each of these is genuinely process-global — an analytics SDK, a switches/variables store, the one canvas/viewport, or the one OS window all exist once for the lifetime of the app, not per-scene. A bare module-level singleton would make that reachable from anywhere, but it would also be real shared mutable state across every test file in the same process — two unrelated test files touching `variableStore.setSwitch()` would silently interfere with each other via shared Node module caching. Instead, `Game`'s constructor registers real instances of all five with `this.services.register(...)` (`Services.ts`'s `ServiceRegistry` — a typed, explicit replacement for Godot-style autoloads) and hands them to scene code via `SceneLifecycle.plugins`/`.variables`/`.localisation`/`.viewport`/`.window`, the same convenience pattern `SceneLifecycle.audio`/`.input` already use. This keeps the "reachable from anywhere without dependency injection" property (one instance per `Game`, which in practice means one per running process) while making the instance's lifetime and scope explicit and test-isolable — a `new Game()` in one test never shares state with a `new Game()` in another. Game code that needs a shared, process-wide instance should read it from `ctx.plugins`/`ctx.variables`/`ctx.localisation`/`ctx.viewport`/`ctx.window` (inside a scene's `onLoad`/`onUpdate`) or `game.services.get(...)` directly, never construct or expect a bare importable singleton value.

`CameraSystem` deliberately stays out of this list — a camera is naturally per-scene (a scene may want its own camera, or several, or none); game code constructs `new CameraSystem()` and calls `camera.attach(stage)` itself, and neither `Game` nor `RenderPipeline` ever auto-wires one.

### PhysicsSystem3D must be destroyed

Rapier3D allocates its world and body buffers in WASM linear memory, which is outside the JavaScript heap. The garbage collector cannot see this memory. Calling `physics.destroy()` runs Rapier's internal Drop implementation and frees the WASM allocation. If `destroy()` is not called when a scene unloads, the WASM heap grows permanently for the lifetime of the process. On long play sessions that transition between scenes frequently, this causes out-of-memory crashes.

### `onUpdate` must not be async

The game loop calls `onUpdate(dt)` as a plain synchronous function and does not await the return value. If `onUpdate` is declared async, the async/await machinery creates a Promise that is silently discarded. Work scheduled after an await inside `onUpdate` runs at an undefined time, divorced from the game loop's frame budget. The engine also cannot catch errors thrown after an await in `onUpdate`. Use `entity.startCoroutine` for work that spans multiple frames.

### Shared internal helpers — `internal/scoped.ts` and `internal/fields.ts`

Two tiny cross-cutting helpers live in `packages/engine/src/internal/` specifically so a recurring pattern doesn't get hand-rolled a fifth time. Check here before writing a new per-world/per-scene side-table or a new "write this field into this component's store" loop.

`scoped.ts` exports `getOrCreate(weakMap, key, create)` and `getOrCreateMapEntry(map, key, create)` — the "look up by key, or create and store a fresh value" check that `ComponentRegistry.ts`'s per-`World` registry, `components/PhysicsBody.ts`'s per-`World` callback/handle side-table, and `RenderPipeline.ts`'s per-`Scene` sprite tracking and overlay containers all need. A future side-table scoped by `World` or `Scene` (or any other object key) should use one of these instead of re-writing the same four-line null check.

`fields.ts` exports `setField(store, field, index, value)` and `setFields(store, index, values)` — "write field F at index I into a component's parallel-array store, growing the array if this is the first write to that field." `Entity.add()`'s defaults/overrides loops, `createComponentProxy`'s setter trap (also in `Entity.ts`), and `ComponentRegistry.ensure()`'s shape-change reset path all route through this. Any new code that writes directly into a `Record<string, unknown[]>` component store (rather than going through `entity.get()`/`entity.add()`) should use `setField`/`setFields`, not reimplement the grow-on-first-write check inline.

### Typed game-wide globals

`GameGlobals` (empty, augmentable interface in `systems/GlobalStore.ts`) types `GlobalStore.get/set` per key via declaration merging; undeclared names use the untyped overloads. The IDE keeps declared globals in `useGameGlobalsStore` (name -> TS type string), and `services/gameGlobalsTypes.ts` regenerates an ambient augmentation of the flattened `@emptysock/engine/__internal/systems/GlobalStore` module into Monaco whenever it changes (wired in `MonacoSetupService`). There is still no bare importable global; reach it via `ctx.globals`/`game.globals`. The Game Globals panel (`components/panels/GameGlobalsPanel.tsx`, module id `globals`, bottom group, docs in manual 7.18a) edits the store: `useHistory` is the source of truth for edits (undo/redo, 50 steps) and an effect pushes each state into the store via `syncGlobals()` (remove gone names, set changed ones), which triggers the Monaco sync; Ctrl+Z is only handled while the panel is visible. Declarations persist in the project file as `gameGlobals` (name -> type expression) through `ProjectSerializer` (`hydrateGameGlobals`/`resetGameGlobalsStore`; reset on `resetProject` and on load, non-string entries dropped), so the Monaco augmentation returns on open; runtime values are not persisted. Tests: `GameGlobalsPanel.test.tsx`, `ideStore.test.ts`.

### SignalBus: a `Game` service, synchronous, scene-scoped via `SignalGroup`

`systems/SignalBus.ts` is the engine's signal/broadcast primitive (`game.signals`, `ctx.signals`; registered like `GlobalStore`, so one per `Game`, never a module singleton). Dispatch is synchronous in registration order; one throwing listener never blocks the rest (errors surface as one `AggregateError`). Scenes should subscribe through `bus.group()` and `dispose()` it in `onDestroy` so handlers cannot outlive their scene. It is distinct from `ActorSystem` (addressed mailboxes drained before update) and from `QueryChannel` (tooling bridge). `docs/reference/systems/signal-bus.md`, manual section 5.40, and the `emptysock-ai-skills` skill (`skills/37-signal-bus.md`) plus its `api-reference.json` entry.


### SignalBus: `onEntity` and built-in entity events

`SignalBus.onEntity(entity, name, fn)` registers into a per-`(World, eid)` `SignalGroup` (side table in `systems/SignalBus.ts`) that `Scene.destroy` disposes through `clearEntitySignals`, alongside the other per-entity clears, so pooled ids do not inherit listeners. `Scene` has no bus reference; it exposes `onDestroyed(cb)` / `onParented(cb)` hooks and `Game.forwardSceneSignals` forwards them as `entity:destroyed` `{ ref }` and `entity:parented` `{ child, parent }` for main and overlay scenes (payloads are scene-local `EntityRef`s; `ref` is `NO_REF` when nothing ever took the entity's id). `entity:destroyed` fires before teardown while the entity is still alive. See actors-and-ecs.md for the reference/relation design.

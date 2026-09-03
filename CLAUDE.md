# EmptySock Engine — AI Agent Guide

This file is the decision record for the monorepo. It records conventions and non-obvious architectural choices. For API signatures and worked examples, see the offline manual in `docs/manual/`.

---

## Offline manual

| Section | Path                                 | Topic                                                                    |
| ------- | ------------------------------------ | ------------------------------------------------------------------------ |
| 1       | docs/manual/01-prerequisites.md      | Node, Rust, Android/iOS SDKs, system libs                                |
| 2       | docs/manual/02-getting-started.md    | Install, run, export pipeline                                            |
| 3       | docs/manual/03-architecture.md       | Layers, ECS, Actor Model, data flow                                      |
| 4       | docs/manual/04-core-reference.md     | Scene, Entity, Timer, Coroutine, Camera                                  |
| 5       | docs/manual/05-systems-reference.md  | Physics 2D/3D, Input, NavMesh, Save, i18n, Plugin                        |
| 6       | docs/manual/06-actor-model.md        | Actor, ActorSystem, NetworkActor, Transport                              |
| 7       | docs/manual/07-ide-reference.md      | All panels, shortcuts, build pipeline, PWA                               |
| 8       | docs/manual/08-tutorial-pong.md      | Step-by-step: full game from scratch                                     |
| 9       | docs/manual/09-troubleshooting.md    | Common pitfalls and how to diagnose them                                 |
| 10      | docs/manual/10-language-reference.md | Offline TypeScript & JavaScript reference for engine scripting           |
| 11      | docs/manual/11-gms2-migration.md     | GMS2 → EmptySock migration guide: import tool, GML mapping, asset status |
| 14      | docs/manual/14-glossary.md           | Canonical terms, deprecated aliases, definitions                         |

---

## Repo layout

Four top-level packages: `packages/engine` (@emptysock/engine, the runtime), `packages/types` (@emptysock/types, shared interfaces with no implementation), `packages/toolchain` (@emptysock/toolchain + the emptysock-toolchain CLI binary), and `apps/ide` (Tauri v2 + React/Vite). Each panel in the IDE is a single file under `apps/ide/src/components/panels/`. All editor state lives in `apps/ide/src/store/ideStore.ts` (Zustand). Build logic lives in `apps/ide/src/services/`.

---

## Non-obvious decisions

### Engine environment boundary

The engine package must not import anything from the DOM, from Tauri APIs, or from `apps/ide`. The reason is that the same compiled engine bundle runs in three contexts: Node.js (Vitest), the browser preview iframe (IDE), and the Tauri WebView (desktop). An import of a DOM-only API causes silent runtime failures in Node, not a compile error. Enforce this by reviewing any new engine import against the allowed list: the TypeScript standard library and other `@emptysock/*` packages only.

### Actor mailbox ordering

ActorSystem drains every actor's inbox before calling update() on any actor. This means all messages sent during frame N are fully processed before frame N's update() logic runs on any actor. A consequence: messages sent inside an actor's receive() are processed in the same flush pass, not deferred to the next frame. If you add a message loop that causes an actor to send back to itself, the flush will run until the inbox is empty — an infinite loop if the actor always re-enqueues.

### Transport is an interface, not a class

NetworkActor accepts a Transport interface. The engine never ships a concrete WebSocket or WebRTC implementation. The reason is bundle size: games that have no multiplayer should not pay for the weight of a WebSocket client or WebRTC negotiation stack. The concrete implementation lives in game code and is injected at runtime. Do not add a concrete transport to the engine package.

### PluginSystem singleton

The pluginSystem export is a module-level singleton, not something that gets constructed in each scene. The reason is that plugins are process-global — an analytics SDK, an ads library, or a platform achievement system exists once for the lifetime of the app, not per-scene. Constructing a new PluginSystem per scene would require all consumers to hold a reference to the right instance. The singleton makes inject() callable from anywhere without dependency injection.

### Tauri detection at runtime

Code that needs Tauri capabilities must check `'__TAURI_INTERNALS__' in window` at the call site, not at build time. There is no separate Tauri build and browser build — both modes run the same bundle. Build-time detection (env vars, define flags) would produce two artifacts that need to be maintained separately. The runtime check costs one property lookup per call; the payoff is a single deployable that works in both modes.

### rc-dock owns the full viewport

DockLayout is the sole child of the IDE's root flex container. Never add a sibling element with fixed height alongside it. rc-dock calculates panel sizes from its own bounding box. A sibling that consumes vertical space causes the layout to overflow — the bottom panels become partially hidden and the overflow does not scroll because DockLayout sets its own overflow policy. Add persistent UI (a title bar, a status bar) by making it a DockLayout tab, not a flex sibling.

### No loading screen, no splash screen

The engine does not own a loading screen or a splash screen. The first scene starts immediately once the engine bundle and user bundle have executed — there is no engine-inserted transition, delay, or branded screen before the developer's code runs. Do not add one. If a game needs a loading screen or a splash screen, the developer creates it as a scene like any other (typically the `startScene`), controls its duration with `async onLoad`, and navigates away when ready. The engine's job is to get out of the way.

### GPU flags in lib.rs

NvOptimusEnablement and AmdPowerXpressRequestHighPerformance are declared as `#[no_mangle] pub static` in the Tauri lib.rs. The `#[no_mangle]` attribute prevents Rust's linker from mangling or eliminating the symbol. The GPU driver on Windows and Linux reads these symbol names from the compiled binary's export table at the OS level — there is no API call involved. If these symbols are removed or marked private, the driver silently falls back to the integrated GPU. This is not detectable at runtime.

### PhysicsSystem3D must be destroyed

Rapier3D allocates its world and body buffers in WASM linear memory, which is outside the JavaScript heap. The garbage collector cannot see this memory. Calling physics.destroy() runs Rapier's internal Drop implementation and frees the WASM allocation. If destroy() is not called when a scene unloads, the WASM heap grows permanently for the lifetime of the process. On long play sessions that transition between scenes frequently, this causes out-of-memory crashes.

### onUpdate must not be async

The game loop calls onUpdate(dt) as a plain synchronous function and does not await the return value. If onUpdate is declared async, the async/await machinery creates a Promise that is silently discarded. Work scheduled after an await inside onUpdate runs at an undefined time, divorced from the game loop's frame budget. The engine also cannot catch errors thrown after an await in onUpdate. Use coroutines (entity.startCoroutine) for work that spans multiple frames.

### virtualFiles must include all open files

The esbuild-wasm virtual filesystem plugin intercepts relative imports at build time by looking up the importer path and the import specifier in the virtualFiles map. If a file is open in the IDE but not present in virtualFiles when the build runs, the import resolves to nothing — esbuild treats it as an error, but the error message names the specifier, not the missing map entry. Always pass the full openFiles record from the IDE store into GameBuildService.buildNow().

### NavMesh data is offline

NavMeshSystem.load() accepts a pre-built polygon graph. There is no API to generate the navmesh from a tilemap at runtime. Building a polygon graph from raw tile data requires Delaunay triangulation and polygon merging, which is O(n log n) and would block the main thread for hundreds of milliseconds on a large level. Build the navmesh in the level editor (or a preprocessing step) and ship the polygon data as a JSON asset.

### Component types as identity keys

addComponent and getComponent use the component constructor function as the key. Do not create abstract base classes and then use the base class in getComponent calls expecting a subclass instance. The lookup is strict: `getComponent(BaseHealth)` will not find a component added with `addComponent(SpecializedHealth)`. One component type per entity slot is intentional — it prevents ambiguous multi-component queries.

### One ActorSystem per scene

Create a new ActorSystem in onLoad and destroy it in onDestroy. A shared ActorSystem that persists across scenes will process stale messages from actors that belong to an unloaded scene. Since actors from the old scene are still registered, broadcast() will invoke them after their scene's onDestroy has run, causing use-after-destroy bugs that are difficult to reproduce.

---

## Canonical terms

All documentation, skill files, and agent prompts must use the canonical spelling from [`docs/manual/14-glossary.md`](docs/manual/14-glossary.md). That file lists every term with its deprecated aliases and a one-line definition. Key points:

- `ActorSystem` — one word, never "Actor System"
- `NavMeshSystem` / `NavMesh` — capital M, never "navmesh" or "Navmesh"
- `PluginSystem` — one word; the singleton instance is `pluginSystem` (lowercase p)
- `Story Graph` — two words with spaces; the runtime is `VNSystem` (not "VN System"); the deprecated panel name "VN Graph" must not appear in new docs
- `VisualScriptComponent` — one word; the panel label "Visual Script Editor" uses spaces only in prose, not in class names
- `Tilemap` — one word, capital T; not "TileMap" or "tile map"
- `Localisation` — British spelling throughout; never "Localization"
- `esbuild` — all lowercase, one word; never "ESBuild" or "Esbuild"

---

## Conventions

**Commits** follow the Conventional Commits spec, enforced by Husky and commitlint. The format is `type(scope): subject`. Valid types: feat, fix, docs, chore, refactor, test, perf, ci. Never bypass the hook with `--no-verify`; it also runs lint-staged (ESLint + Prettier), so bypassing it leaves unformatted code in git.

**File placement:** engine systems go in `packages/engine/src/systems/`, engine core primitives in `packages/engine/src/core/`, IDE panels in `apps/ide/src/components/panels/`. New exports from the engine must be re-exported from `packages/engine/src/index.ts`.

**Adding a new engine system:** create the file, export from index.ts, add an entry to api-reference.json, add a section to docs/manual/05-systems-reference.md, add a skill to eleferrets/emptysock-ai-skills.

**Adding a new IDE panel:** create the component file, add a makeTab entry to DEFAULT_LAYOUT in App.tsx, document it in docs/manual/07-ide-reference.md. If the panel needs store state, use useIDEStore — never local useState that other panels cannot read.

**Undo / redo is mandatory in every panel that mutates editor data.** Use a shared `useHistory<T>` hook that snapshots state before each mutation and exposes `undo()` / `redo()` / `canUndo` / `canRedo`. Wire `Ctrl+Z` / `Ctrl+Shift+Z` globally. Cap history at 50 steps per panel (session-only, never persisted). Monaco has its own per-file undo stack — do not replace it. Every panel added going forward must ship with undo/redo on day one, not as a follow-up.

**Naming:** TypeScript files use PascalCase for classes and camelCase for modules. Tauri commands in lib.rs use snake_case. CSS variables use the `--es-` prefix to avoid collisions with third-party stylesheets.

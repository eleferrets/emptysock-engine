# EmptySock Engine — AI Agent Guide

This file is the decision record for the monorepo. It records conventions and non-obvious architectural choices. For API signatures and worked examples, see the docs at `docs/`.

---

## Documentation

The docs follow a Unity/Unreal-style layout — four sections that match different reading modes. Start at `docs/README.md` for a full navigation table.

| Section            | Path                         | What it covers                                                                                    |
| ------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------- |
| Getting Started    | `docs/getting-started/`      | Installation, first game, IDE tour, from GameMaker                                                |
| Guides             | `docs/guides/`               | Task-oriented: physics, input, saving, navmesh, actors, plugins, hot-reload, building             |
| Reference          | `docs/reference/`            | Indexed by class/system — Scene, Entity, all systems. Ctrl+F destination, not sequential reading. |
| Tutorials          | `docs/tutorials/`            | Pong, platformer, visual novel, bullet hell — complete step-by-step projects                      |
| Architecture       | `docs/architecture.md`       | Layers, ECS, Actor Model, IDE data flow (contributor deep-dive)                                   |
| Troubleshooting    | `docs/troubleshooting.md`    | Common pitfalls and how to diagnose them                                                          |
| Glossary           | `docs/glossary.md`           | Canonical term spellings, deprecated aliases, definitions                                         |
| Language Reference | `docs/language-reference.md` | TypeScript & JavaScript reference for engine scripting                                            |

> The legacy `docs/manual/` files remain for backward compatibility with external links. New content goes in the directories above.

---

## Repo layout

Five top-level packages: `packages/engine` (@emptysock/engine, the runtime), `packages/types` (@emptysock/types, shared interfaces with no implementation), `packages/toolchain` (@emptysock/toolchain + the emptysock-toolchain CLI binary), `packages/network` (@emptysock/network, the optional Colyseus multiplayer companion package — §11.4/§23.2 — never imported by @emptysock/engine itself), and `apps/ide` (Tauri v2 + React/Vite). Each panel in the IDE is a single file under `apps/ide/src/components/panels/`. All editor state lives in `apps/ide/src/store/ideStore.ts` (Zustand). Build logic lives in `apps/ide/src/services/`.

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

addComponent and getComponent use the `component.type` string field as the key, not the constructor function. The internal map is `Map<string, Component>`. Do not assume two components with different classes but the same `type` string are distinct — they will collide. The lookup is strict: `getComponent("BaseHealth")` will not find a component whose `type` is `"SpecializedHealth"`, even if one extends the other. One component type string per entity slot is intentional — it prevents ambiguous multi-component queries.

### One ActorSystem per scene

Create a new ActorSystem in onLoad and destroy it in onDestroy. A shared ActorSystem that persists across scenes will process stale messages from actors that belong to an unloaded scene. Since actors from the old scene are still registered, broadcast() will invoke them after their scene's onDestroy has run, causing use-after-destroy bugs that are difficult to reproduce.

### Collision/sensor callbacks live on PhysicsBody, dispatched by PhysicsSystem

Registration (`onCollisionEnter`, `onSensorEnter`, etc.) belongs on `PhysicsBody` because that's the value component game code already holds a reference to after `entity.getComponent("PhysicsBody")` — no second lookup, no event-bus indirection. Dispatch (`dispatchCollisionEnter`, etc.) is `PhysicsSystem`'s job because it owns the Rapier `World`/`EventQueue` and is the only thing that ever observes a real collision. `PhysicsSystem._drainCollisionEvents()` still also emits `entity.emit("collisionEnter", ...)` for existing consumers of the old entity-event path — both fire side by side, no behavioural regression for code written against the old API.

### Scene transitions: SceneManager times them, RenderPipeline paints them

`SceneManager.transition()` takes an `effect: TransitionEffect` but never imports pixi — it stays inside the engine environment boundary (Node/browser/Tauri all run it). It drives a minimal `TransitionEffectSink` interface (`beginTransition`/`transitionProgress`/`endTransition`) via `attachPostProcess()`; `PostProcessSystem` satisfies that shape structurally. Actual pixels come from `RenderPipeline.renderTransitionOverlay(postProcess)`, which reads `PostProcessSystem`'s `transitionEffect`/`transitionProgress`/`transitionColour` and draws a full-screen `Graphics` rect — a triangle wave for `fade`, a growing rect for `wipe`, a rect sweeping across the screen for `slide`. This is an overlay-based transition (one rect on top of whatever's currently rendered), not a true two-scene crossfade — RenderPipeline doesn't keep two scenes' sprites live simultaneously. Good enough for a cut-covering transition; revisit if a game needs to see both scenes blending.

### export-utils has no desktop packaging path — use packages/toolchain/src/desktopBuild.ts

`packages/export-utils`'s `exportWindows`/`exportMacOS`/`exportLinux` were deleted — they were a second, unwired, non-functional desktop packaging implementation (fake NSIS script, an empty `.app` directory with no compiled binary, a hand-assembled `.AppImage`). `packages/toolchain/src/desktopBuild.ts` is the one real desktop export path: it scaffolds an actual Tauri v2 project and runs `cargo tauri build`. If desktop export logic needs to change, change it there — don't resurrect the export-utils versions. `exportWeb`/`exportAndroid`/`exportIOS`/`exportRaspi` still live in export-utils since desktopBuild.ts doesn't cover those targets, but nothing currently calls them from the CLI either.

### GMS2 `.yyp`/`.yy` are not strict JSON, and other real-format quirks

Learned by testing the importer once, end to end, against a real full GameMaker export provided temporarily by the user solely for that purpose; the project data was deleted from disk immediately after and was never committed. Permanently captured as synthetic regression tests in `packages/toolchain/src/__tests__/gms2-import.test.ts`. The quirks:

- `.yyp`/`.yy` files are **not strict JSON** — GameMaker's IDE always writes a trailing comma before the final `}`/`]` of every object and array. Strip `,(\s*[}\]])` → `$1` before parsing.
- The project's own display name lives at `.yyp` root under `"%Name"`, not `"name"`.
- Object events go well beyond `Create_/Step_/Draw_/Destroy_`: collision handlers are `Collision_<other object name>.gml`, keyboard handlers are `KeyPress_<vk code>.gml`/`KeyRelease_<vk code>.gml` (37-40 = arrow keys). Emit `onCollideWith<Other>()`/`onKeyPress<Name>()`/`onKeyRelease<Name>()`.
- Room `.yy` layers identify their kind via `resourceType` (`"GMRInstanceLayer"`, `"GMRTileLayer"`, `"GMRBackgroundLayer"`, …), never `"layerType"`.
- Sprites store one PNG per frame at the sprite directory root, named by that frame's own UUID (`.yy` `frames[].name`), never `<sprite name>.png`.
- `defaultScriptType: 1` does **not** reliably mean "uses GML Visual" — do not warn on it alone.
- Real projects carry legacy GameMaker 8.1 DnD-compatibility symbols (`action_move`, `gml_pragma`, etc.) in compiled action lists — leave these untranspiled (surface as unresolved identifiers) rather than faking them.

### rc-dock: newly enabled modules must be docked by anchor tab, not floated

`openPanelInLayout` in `apps/ide/src/App.tsx` used to add a not-yet-present module tab with `layout.dockMove(factory(), null, "float")`, which always spawns rc-dock's floating-window fallback regardless of which tab group the module belongs to. The fix looks up an existing anchor tab for the module's group ("canvas" for main-panel modules, "assets" for bottom-panel modules) via `layout.find(anchorId)` and calls `layout.dockMove(factory(), anchorId, "middle")` to dock into that pane, falling back to float only if the anchor tab is missing. `closePanelInLayout` (`dockMove(tab, null, "remove")`) removes a module's tab when it's disabled — toggling a module off used to leave its tab dangling. Any future "enable an optional panel at runtime" feature must dock against an anchor tab this way, never call `dockMove` with a `null` target and `"float"` direction for a tab that has a real home.

### Monaco resolves `@emptysock/engine` via one ambient module block, not per-file extra libs

The bundled Monaco TypeScript worker only supports `ModuleResolutionKind.Classic | NodeJs`, which cannot resolve the bare specifier `@emptysock/engine` from a pile of per-file `addExtraLib` entries at `file:///node_modules/@emptysock/engine/**` (this produced `TS2792: Cannot find module`, cascading into false "Property X does not exist" errors on every inherited method). `engineTypesPlugin` in `apps/ide/vite.config.ts` instead flattens `packages/engine/dist-types/**/*.d.ts` into synthetic ambient modules (`declare module "@emptysock/engine/__internal/<path>" { ... }`, with every relative specifier rewritten to the matching synthetic name) and re-exports them all through one `declare module "@emptysock/engine" { export * from "@emptysock/engine/__internal/index"; }` block. Ambient declarations for a bare specifier are looked up by name directly, bypassing module resolution entirely. If `packages/engine`'s public type surface changes shape (e.g. new subpath exports), this flattening logic in `engineTypesPlugin` needs to know about the new entry points, not just the dist-types glob.

### SaveSystem storage backend is an injected adapter, not a runtime check

`v2/systems/SaveSystem.ts` needs one save/load API that ends up on IndexedDB
in the browser preview and Tauri's fs plugin on desktop (§19.3), but unlike
the "Tauri detection at runtime" pattern elsewhere in this file, `SaveSystem`
does **not** check `'__TAURI_INTERNALS__' in window` itself. Doing so would
still require importing (even dynamically) an IndexedDB or
`@tauri-apps/plugin-fs` code path from inside `@emptysock/engine`, which is
exactly what "Engine environment boundary" forbids — the same compiled
engine bundle has to keep running under plain Node/Vitest with zero DOM or
Tauri surface touched. Instead `SaveSystem` takes a `StorageAdapter`
interface (`get`/`set`/`delete`/`listKeys`), the same shape as
`NetworkActor`'s `Transport`: the engine defines and depends on the
interface, never a concrete implementation. The IndexedDB and Tauri-fs
adapters are built and runtime-selected by the host (`apps/ide`'s preview
shell, the Tauri desktop shell) and injected into `SaveSystem`'s
constructor. With no adapter given, `SaveSystem` defaults to
`MemoryStorageAdapter` (an in-process `Map`, nothing persisted across
restarts) — this is what makes it usable out of the box under the headless
testing harness and any other Node context.

Separately, `ComponentDef` now carries a `version: number` (default `1`,
set via `defineComponent(name, defaults, { version })`'s optional third
argument — purely additive, every existing two-argument call site is
unaffected). `SaveSystem` stamps every saved component instance with its
def's version; on load, a stamped version that doesn't match the
currently-registered def's version runs a migration registered via
`SaveSystem.registerMigration(componentName, migrate)`, or — if none is
registered — logs a warning and drops just that one component's data for
that one entity. Everything else in the save still loads; a schema
mismatch on one component type never aborts or corrupts the rest of the
load.

### @emptysock/network's field-marking and entity-mapping scheme

`packages/network` (`@emptysock/network`) marks which component fields are replicated with `networked(componentDef, ["field", ...])`, called next to `defineComponent`, not a `defineNetworkedComponent` wrapper — this composes with `ComponentRegistry`'s existing name-keyed identity instead of parallelling it. The mark is stored in a module-level `Map<componentName, Set<fieldName>>` keyed on the same `componentName` string `ComponentRegistry` uses, not on the `ComponentDef` object's identity, because client and server are two separately-loaded copies of the game's component definitions (and a hot-reloaded module produces a new `ComponentDef` reference for "the same" component per §23.1 anyway) — object identity was never going to survive either trip.

Network room state (a Colyseus `MapSchema`) has no notion of a local bitECS entity id, and entity ids are only unique within one process's `World`. `NetworkEntityMap` bridges the two by mapping a Colyseus network id (the schema collection's own key — typically `room.sessionId` for a player, or a synthetic key for server-spawned entities) to a local `Entity` handle, keyed internally on `entity.rawId` (the one entity-identifying field the v2 `Entity` API exposes publicly — `eid` itself is `@internal` and does not survive into `dist-types`). `NetworkSystem` never reaches past `entity.get(Component)` to read or write a networked field, per §23.2's explicit constraint that this package must never need to know bitECS exists. Outbound replication is a per-call dirty-check poll (`NetworkSystem.sync()`, meant to be called at a low fixed cadence, not every frame) rather than intercepting the `.get()` proxy's setter — cheaper to reason about, and correct for §23.2's "replicated a handful of times a second to a handful of clients" cost model, which is not the case `scene.each()`'s no-proxy fast path exists for.

### Prefab pooling keeps a pooled entity bitECS-alive between destroy and reuse

`Scene.spawn(prefab, props, { pool: true })`/`Scene.destroy(entity)`
(`packages/engine/src/v2/{Prefab,Scene}.ts`, ENGINE_DESIGN.md §12.4) fold
pooling into the ordinary spawn/destroy calls, but a pooled entity's bitECS
id is deliberately **not** released back to bitECS's own id-recycling on
destroy — only its components are stripped. If it were released, bitECS's
own "next `addEntity()` gets the freed id" recycling (§23) could hand that
id to a completely unrelated `spawn()` elsewhere before this prefab's pool
claims it back, which would break "this pool only reuses slots this prefab
previously owned." The consequence: `entity.isAlive` on a pooled-and-
destroyed entity's old handle reads `true`, not `false` — unlike a normal
(non-pooled) `destroy()`, where the handle goes properly stale. Game code
holding that old handle sees the practical equivalent of "destroyed"
anyway (`.get()` returns `undefined` for every component, since none are
attached), but do not write code that branches on `isAlive` to detect
"was this entity destroyed" for a pooled entity — check `.has()`/`.get()`
against the components you actually care about instead.

### Prefab `.d.ts` codegen lives in toolchain, not the engine

`generatePrefabTypes` (`packages/toolchain/src/prefabCodegen.ts`,
ENGINE_DESIGN.md §13.4) reads a project's `.prefab.json` files plus the
project's real, registered `ComponentDef`s and emits a `.d.ts` string
declaring one `PrefabDef<{...}>`-typed `declare const` per prefab. It lives
in `packages/toolchain`, not `packages/engine/src/v2`, because it never
touches a `Scene`/`World` — it's pure offline codegen, the same "reads
source files, emits a sibling file" shape as the GMS2 importer, not a
runtime capability. The engine side (`packages/engine/src/v2/SceneFile.ts`)
owns the complementary runtime half — parsing that same prefab/scene JSON
into a `PrefabDef` a live `Scene` can actually `spawn()` — and both sides
import the same `ComponentLookup`/`PrefabFile` shapes from
`@emptysock/engine/v2` so the two halves can't drift apart on what a field
means. `PrefabDef<T>` itself carries an unused, `@internal` `__props?: T`
phantom field purely so `Scene.spawn<T>(prefab: PrefabDef<T>, props?:
Partial<T>)` can infer `T` from whichever prefab value is passed —
`definePrefab` leaves `T` at its `SerializableRecord` default for
hand-authored prefabs, and `generatePrefabTypes`'s emitted `declare const`
is what actually pins `T` to a concrete shape for a JSON-authored one.
Wiring `generatePrefabTypes` into an actual IDE auto-save hook or a
`packages/toolchain/src/cli.ts` build command is a noted follow-up in
`RELEASE_PASS.md`, not done yet — the function itself is real and tested.

### Input snapshot: frozen by copy, not by timing

ENGINE*DESIGN.md §4 step 1 requires input "polled once, frozen for the
frame". `v2/Input.ts`'s `InputManager.snapshot()` (called once, first, by
`Game.update()`) does this by making an actual copy — `keys:
input.snapshotKeys()` (a fresh `Map`), a fresh `Map` of every gamepad's
state, and the current `touches` array — into a private `_frozen` object.
`isDown()`/`keyboard`/`gamepad()`/`touches` all read only `_frozen`, never
the live `InputSystem`/`GamepadSystem` underneath. This matters because
`InputSystem`'s own `_keys` map is mutated live by DOM event listeners
between synchronous ticks of the event loop — relying on "JS is
single-threaded, so nothing can mutate it mid-`update()`" would happen to
work for real device events, but it would silently break the instant
anything called `InputSystem`'s internals directly instead of through the
frozen copy (and does not hold at all for the headless test-injection path
below, which calls into `InputSystem` synchronously, same tick, deliberately
mid-"frame" to prove the freeze holds). Copy-based freezing makes the
guarantee independent of \_how* something tries to change input mid-frame,
not just "how fast the OS can deliver an event".

Headless/testing input injection is non-DOM on purpose:
`InputSystem.simulateKeyDown(code)`/`simulateKeyUp(code)` write directly to
the internal key map — no `KeyboardEvent`, no `window`, no jsdom dependency
— so `@emptysock/engine`'s Node/Vitest path (CLAUDE.md's "Engine environment
boundary") can exercise real action-mapping and freeze-per-frame behavior
without a DOM. `Game` never calls `InputManager.attach()` itself; only
host bootstrap code (browser preview shell, Tauri WebView entry point) does,
which is what keeps a headless `Game` from touching `window` at all.

### Audio stays a Game-owned singleton, not a per-entity component

`v1`'s `AudioSystem` (Howler-backed) has no per-entity audio-emitter
component anywhere — games hold a reference to one `AudioSystem` instance
and call `.play(id)` on it directly. There was therefore nothing ECS-shaped
to migrate onto v2's `defineComponent`/bitECS storage for Track 1's
Input+Audio pass; `v2/Game.ts` simply constructs one `AudioSystem` in its
constructor (`game.audio`, also handed through `SceneLifecycle.audio` for
convenience) and never recreates or destroys it on `loadScene`/`unloadScene`
— the same "game-owned, not scene-owned" treatment as `game.input`, since
music commonly needs to keep playing across a scene transition and v1 never
had automatic per-scene audio teardown to preserve. A game that wants
scene-scoped sound (stop this scene's sfx/music on unload) does it
explicitly from that scene's own `onUnload` (e.g. `audio.stop(id)` or
`audio.unloadAll()`) — the engine does not guess at which sounds "belong"
to which scene.

### v2 PhysicsBody callbacks live in a side-table, not the component's fields

`v2/defineComponent<T extends SerializableRecord>` rejects a shape with a
function field at the type level (`v2/Serializable.ts`) — deliberately, so a
component made only of `Serializable` fields can be saved/loaded generically
later. `PhysicsBody`'s `onCollisionEnter`/`onSensorEnter`/etc. are exactly
the kind of field that constraint exists to keep out, so they cannot live in
`PhysicsBody`'s own defaults object. `v2/components/PhysicsBody.ts` instead
keeps a `WeakMap<World, Map<eid, callbacks>>` side-table (the same per-world
scoping pattern `ComponentRegistry` already uses) and hands out a `Proxy` via
`getPhysicsBody(entity)` that reads/writes the real component for ordinary
fields and the side-table for the five callback properties — so
`getPhysicsBody(entity).onCollisionEnter = fn` still reads as "assigning is
the registration" (CLAUDE.md's "Collision/sensor callbacks" decision,
carried into v2) even though the callback and the data never share storage.
`PhysicsSystem` dispatches by reading the side-table directly
(`getPhysicsCallbacks`), not through the proxy. A future component that
wants a callback-shaped property should use the same pattern rather than
loosening `SerializableRecord`.

### v2 physics: deterministic Rapier build is imported via a non-literal specifier

`PhysicsSystem.init()`/`PhysicsSystem3D.init()` choose between
`@dimforge/rapier{2,3}d-compat` and the `-deterministic-compat` build with
`await import(moduleName)` where `moduleName` is a runtime string, not a
literal. A literal `import("@dimforge/rapier2d-deterministic-compat")` would
make TypeScript (and any bundler resolving imports at build time) treat the
deterministic build as a hard dependency of `@emptysock/engine`, which
defeats the point of it being `optionalDependencies` (§15.2 — most games
never install it and shouldn't pay for it, including at install/bundle
time). Keep this non-literal if the deterministic swap logic ever moves.

### v2 RenderPipeline tracks sprites per-`Scene`, not by raw entity id

v1's `RenderPipeline` kept one flat `Map<number, PixiSprite>` because it only
ever rendered a single `Scene`. v2's `Game` can have several live scenes at
once — the main scene plus any `loadOverlay()`-ed overlays (§12.3) — and each
one owns its own bitECS `World`, whose entity ids independently start from 0
(see `v2/Scene.ts`). That means the main scene's entity `eid 3` and an
overlay's entity `eid 3` are two different entities that happen to share a
number. `v2/systems/RenderPipeline.ts` keys its sprite/texture-path tracking
per `Scene` (`Map<Scene, { sprites: Map<number, PixiSprite>, ... }>`) to avoid
aliasing them — the same "never index by a raw entity id without first
scoping by which world it belongs to" rule `ComponentRegistry` and
`PhysicsBody`'s callback side-table already follow (see the "v2 physics:
collision callbacks" entry above), just scoped by `Scene` instead of `World`
since `RenderPipeline` is an external system reaching in, not a component
module. Overlay sprites also skip v1's named `LayerSystem` entirely (it's
keyed by raw entity id with no scene scoping, so feeding it overlay eids
would reproduce the exact collision this exists to avoid) — each overlay
instead gets one flat, self-sorting `Container` appended to the stage after
the main scene's layer containers, which is enough for draw-order-within-an-
overlay without needing cross-container named layers there.

### `Game.attachRenderer` takes a structural interface, not the concrete `RenderPipeline`

`v2/Game.ts` defines `SceneRenderer` (`renderFrame(main, overlays)`) as a
plain interface and never imports `v2/systems/RenderPipeline.ts`, which in
turn imports `pixi.js` and returns `HTMLCanvasElement`. This is the same
pattern as v1's `SceneManager`/`TransitionEffectSink` (see "Scene
transitions: SceneManager times them, RenderPipeline paints them" above):
`Game.ts` has to keep running under the headless testing harness in plain
Node with zero DOM/Pixi involvement (the engine-environment-boundary rule),
so it can only depend on the shape a renderer has, never a concrete
Pixi-backed one. `Game.update()`'s render step (7) is gated on both "a
renderer is attached" and "this scene wasn't loaded with `headless: true`" —
belt-and-suspenders, since a `HeadlessGame` never calls `attachRenderer` at
all, but the second check means it stays safe even if something did.

### Visual script compilation: per-node cases, not a re-implemented interpreter

`VisualScriptCompiler.compileVisualScriptGraph` turns a `VisualScriptGraph`
into a JS module string via `new Function("module", "exports", "console",
source)`, not a bundler/transpile step, so it can compile and load in one
call inside the engine package with zero new build tooling. The graph format
it targets is the _existing_ v1 shape (`VariableStore` get/set var/switch,
`ActorSystem.send`) because that is genuinely what the Visual Script
Editor's Logic Script tab authors today — the graph has no entity/component
or `scene.spawn` node kinds at all, so there was no "v1 vs v2 API" choice to
make for this pass; compiling to v2 calls would mean inventing new node
kinds, which is out of scope for a compiler over the existing format.

The emitted code is a `switch` inside a `while (__next !== undefined)` loop
keyed on node id, not straight-line code, because a `VisualScriptGraph` can
legally contain a cycle (see `VisualScriptComponent.test.ts`'s "does not
loop forever" case) and straight-line generated code cannot represent one.
This is still compiled output, not an interpreter: each `case` is the one
specific statement for that one node with its field values baked in as
literals at compile time (`ctx.variables.setVar(1, 5)`, never a generic
`execute(node)` call reading `node.kind` at runtime) — only the _dispatch
shape_, not the per-node logic, is shared with the interpreter's loop.
`VisualScriptComponent` (the interpreter) is unchanged and stays the
default runtime path; `CompiledVisualScriptComponent` is an opt-in, same-
shape drop-in for games that want to ship compiled logic instead. Both are
tested against each other node-by-node so they can never silently diverge
in behaviour.

### MCP server has no 3D physics tool

`physics_raycast_3d` is listed in the emptysock-mcp tool registry but explicitly throws "not implemented", and its test asserts that behaviour. Do not implement it without a Rapier3D WASM build available server-side — the engine's 3D physics runs in the browser WASM context, not in Node.

---

## Canonical terms

All documentation, skill files, and agent prompts must use the canonical spelling from [`docs/glossary.md`](docs/glossary.md). That file lists every term with its deprecated aliases and a one-line definition. Key points:

- `ActorSystem` — one word, never "Actor System"
- `NavMeshSystem` / `NavMesh` — capital M, never "navmesh" or "Navmesh"
- `PluginSystem` — one word; the singleton instance is `pluginSystem` (lowercase p)
- `Story Graph` — two words with spaces; the runtime is `VNSystem` (not "VN System"); the deprecated panel name "VN Graph" must not appear in new docs
- `VisualScriptComponent` — one word; the panel label "Visual Script Editor" uses spaces only in prose, not in class names
- `Tilemap` — one word, capital T; not "TileMap" or "tile map"
- `Localisation` — British spelling throughout; never "Localization"
- `esbuild` — all lowercase, one word; never "ESBuild" or "Esbuild"

---

## Between-session task tracking

`RELEASE_PASS.md` (next to this file) is the canonical task checklist for work that spans agent sessions. Before starting any multi-step pass, write open items there with `[ ]` so context compaction cannot lose them. Mark `[x]` when done. Do not duplicate it in companion repos.

---

## Conventions

**Commits** follow the Conventional Commits spec, enforced by Husky and commitlint. The format is `type(scope): subject`. Valid types: feat, fix, docs, chore, refactor, test, perf, ci. Never bypass the hook with `--no-verify`; it also runs lint-staged (ESLint + Prettier), so bypassing it leaves unformatted code in git.

**File placement:** engine systems go in `packages/engine/src/systems/`, engine core primitives in `packages/engine/src/core/`, IDE panels in `apps/ide/src/components/panels/`. New exports from the engine must be re-exported from `packages/engine/src/index.ts`.

**Adding a new engine system:** create the file, export from `packages/engine/src/index.ts`, add an entry to `ai/api-reference.json` in `eleferrets/emptysock-ai-skills`, add a page under `docs/reference/systems/`, add a row to `docs/reference/index.md`, add a section to `docs/manual/05-systems-reference.md`, and add a skill file to `eleferrets/emptysock-ai-skills`. All five locations in a single commit — never land a new system without docs.

**Adding a new IDE panel:** create the component file, add a makeTab entry to DEFAULT_LAYOUT in App.tsx, document it in docs/manual/07-ide-reference.md. If the panel needs store state, use useIDEStore — never local useState that other panels cannot read.

**Keeping docs in sync with engine changes:** any commit that adds, removes, or changes a public engine API must also update the corresponding page in `docs/manual/` (offline manual source) and `docs/reference/` (the Ctrl+F reference). Method signature changes update the reference page. Behaviour changes update both. Never merge an engine change that leaves the docs describing the old shape.

**Undo / redo is mandatory in every panel that mutates editor data.** Use a shared `useHistory<T>` hook that snapshots state before each mutation and exposes `undo()` / `redo()` / `canUndo` / `canRedo`. Wire `Ctrl+Z` / `Ctrl+Shift+Z` globally. Cap history at 50 steps per panel (session-only, never persisted). Monaco has its own per-file undo stack — do not replace it. Every panel added going forward must ship with undo/redo on day one, not as a follow-up.

**Naming:** TypeScript files use PascalCase for classes and camelCase for modules. Tauri commands in lib.rs use snake_case. CSS variables use the `--es-` prefix to avoid collisions with third-party stylesheets.

**Versioning:** the monorepo uses [changesets](https://github.com/changesets/changesets) (`.changeset/`) to track package version bumps. Run `pnpm changeset` when your PR changes a published package's public behavior, following the prompts to pick a bump type and write a summary. `apps/ide` is excluded (it's an app, not a published package). All packages are currently `private: true`, so `access: restricted` is the default in `.changeset/config.json` until one is actually published to npm.

---

## IDE UI checklist (every new panel)

- **CSS variables only.** Never hardcode colors for surrounding UI (backgrounds, borders, text, header bars). Canvas drawing (WebGL previews, profiler charts) may use semantic hex values for clarity. The IDE supports light and dark themes; hardcoded hex colors will break in light mode.
- **Empty states.** Every list, table, or grid must show a helpful message when empty — not a blank box. The message should tell the user what to do next (e.g., "No assets yet — drag files here or click Upload."). Search results with no matches need a separate "No results" message, not silence.
- **Conditional UI.** A control tied to absent data must not render as a broken/empty element. For example, a `<select>` with no `<option>` elements must be hidden, not shown as an empty picker.
- **Action hint copy.** Instructional text in a panel should be an action ("Click the canvas to place a component") not a state description when the user has nothing yet ("placed: 0 components").
- **commitlint subject-case.** The commitlint `subject-case` rule rejects any uppercase letter in the commit subject, including camelCase or PascalCase identifiers. Rewrite them lowercase (e.g., `outDir` → `outdir`, `ES2025` → `es2025`) or rephrase around them. Test with `echo "type(scope): subject" | npx commitlint` before committing.
- **Tool-specific controls (grid/snap/ruler and similar) live on the tab, not the global toolbar.** Concepts that only apply to some editors — grid, snap, ruler, and anything else scoped to a specific tool rather than the whole IDE — must not be added as global buttons in the top toolbar next to Debug/Export/theme. Render them as a small icon with a tooltip, placed inline next to that tab's name, and only on the tabs/tools that actually use the concept (e.g. grid/snap/ruler belong on the Tilemap editor, the Room/Scene editor, and the UI editor — not on the Code tab or the Console). The top toolbar is for IDE-wide actions; a control that only means something in one panel does not belong there even if it would be convenient to have visible at all times.

---

## Personality

The IDE has a voice: dry, a little self-aware, never annoying. Think a senior dev who's seen things but still enjoys the work. Use it in:

- **Empty-state quips** — idle panels with nothing to show can rotate through a short array of sardonic one-liners picked at `useRef` initialisation (so the quip is stable for the session but varies across opens). Keep the array to 8–12 entries. Tone: deadpan, observational, never cute-overload. Good: `"All quiet. Your game is probably fine."` / `"Zero logs. Zero regrets. Probably."`. Bad: `"Wow, so empty! Let's fill it up! 🎉"`.
- **Status / feedback copy** — build success doesn't need to shout. `"Built in 340 ms."` beats `"✅ Build successful!"`. Error states can acknowledge the pain briefly: `"Something broke. Check above."`.
- **Tooltips and placeholder text** — a tooltip on the Clear button can just say `"Clear"`. A placeholder in a search field can say `"Filter assets…"` rather than `"Search for an asset by name"`.

Rules:

- One quip array per panel maximum. Don't force it into every surface.
- Never use the personality to bury useful information. The quip sits _beneath_ the functional hint, or replaces a purely generic message. If there's a real action to communicate, say it plainly first.
- No exclamation marks in quips. No emoji unless it's a single, well-chosen one in a serious context (e.g., a skull ☠ on a crash panel).
- Keep every quip under 60 characters so it fits on one line at panel width.

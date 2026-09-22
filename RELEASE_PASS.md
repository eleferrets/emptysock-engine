# Release Pass

Cross-session task log. Before starting any work, write open items here with `[ ]`.
Mark `[x]` when done. Keep this file next to `CLAUDE.md` so it survives context compaction.

This is the canonical log — it does not live in companion repos.

Durable architectural decisions that a future agent can't read from the code belong in
`CLAUDE.md`'s "Non-obvious decisions" section, not here — that section is the permanent
record; this file is scratch space for the pass currently in flight. Clear this file
once a pass's items are all `[x]` and anything worth keeping has been migrated there.

---

## Status key

- [x] Done
- [ ] Open
- [~] Partial

---

## Next pass — make the ECS core the one engine, port and delete the rest

**Decided with the project owner on 2026-09-22, before any of this is implemented — read this whole section before touching code.**

The engine currently has two real, different object models living side by side: the ECS core at `packages/engine/src/ecs/` (bitECS-backed, `entity.get(Component)`/`scene.each()`, versioned entity IDs, currently covers only physics, sprite/transform rendering, save, and a query bridge) and the original `Scene`/`Entity`/`Component` at `packages/engine/src/core/` and 32 systems under `packages/engine/src/systems/` (class-based, `entity.getComponent("Name")` keyed by a type string, no ECS presence at all for 27 of those 32 systems). This was a deliberate, incremental choice by the design spec that got this codebase to where it is — not a mistake — but it's not where the engine ends up.

**The decision: the ECS core becomes the one real API. Every one of the 27 unported systems gets ported onto it or deleted. The old `Scene`/`Entity`/`Component` class-based model goes away entirely once nothing depends on it anymore.** This is not a rename or a cleanup pass — expect this to be a multi-session rewrite with a lot of deletion once it's done, not a quick pass.

Explicitly settled, don't re-litigate these:

- **Versioned entity IDs stay as a real guarantee.** A stale `Entity` handle to something destroyed must fail loudly, not silently alias onto a newly-spawned entity — this is native to the ECS core already, nothing extra to build for it.
- **Audit before porting or deleting.** Before touching any of the 27 systems below, check real usage first — some of them (`AutoTileSystem`, `CGGallery`, `CharacterStage` are the suspected candidates, but verify, don't assume) may already be dead weight now that their real logic moved into `@emptysock/vn`/`battle`/`tilemap` this pass. Don't spend a session faithfully porting something nobody calls anymore.

**The 27 systems under `packages/engine/src/systems/` with zero ECS presence today** (verified by directory listing on 2026-09-22 — re-verify, this list can go stale): `AssetManifest`, `AutoTileSystem`, `CGGallery`, `CameraSystem`, `CharacterStage`, `CoroutineSystem`, `CustomShaderFilter`, `DebugOverlaySystem`, `GamepadSystem`, `HotReloadSystem`, `InputBindings`, `InputSystem`, `LayerSystem`, `LightingSystem`, `LocalisationSystem`, `MapEventSystem`, `ParticleSystem`, `PathfindingSystem`, `PointerSystem`, `PostProcessSystem`, `RenderSystem`, `SequenceSystem`, `TweenSystem`, `UISystem`, `VariableStore`, `ViewportSystem`, `WindowSystem`. (`VisualScriptCompiler`, `AudioSystem`, `PhysicsSystem`, `PhysicsSystem3D`, `RenderPipeline`, `SaveSystem` already have ECS-side counterparts or wiring — check each individually before assuming full coverage, some ECS-side versions may only cover part of the old one's surface.)

**Real consumers that assume the old API today, and need to move with it, not just be recompiled against a new one:**

- `apps/ide` — 23 files import the old root `@emptysock/engine` API (Inspector, panels, preview bridge, `IDEBridge`). The live-preview/editing story needs re-validating end to end once the object model underneath changes, not just a recompile.
- `packages/toolchain`'s GMS2 importer (`gms2-gml-stub.ts` and friends) generates `class X extends Scene` targeting the **old** `Scene` class directly. Its generated-code shape needs a real redesign, not a find-and-replace.
- Everything in `emptysock-ai-skills` and this repo's own `docs/`/`ai/` content already describes the ECS core's `entity.get`/`scene.each` shape as _the_ API (from this session's docs pass) — so docs are already pointed the right direction; verify they don't quietly reference any of the 27 old-only systems' current (old) call shape once those get ported, since some skill files describe systems like `UISystem`/`ParticleSystem`/`TweenSystem` against their current, unported API.

Start the next session by auditing real usage of the 27 systems (per the settled decision above), then scope the port order — likely load-bearing-and-widely-used systems first (input, UI, particles), narrow/legacy ones last or deleted outright if the audit shows nobody calls them.

**Four more structural decisions, settled 2026-09-22, same session — also don't re-litigate:**

- **Rollout: system by system, not a big-bang cutover.** Port one system at a time, update its real consumers, verify it, move to the next. The old `Scene`/`Entity` stays alive and working for whatever hasn't been ported yet — `apps/ide` and the toolchain must never be broken mid-pass. Only delete a piece of the old code once nothing depends on it anymore.
- **Not everything becomes a component.** Only genuinely per-entity data (something an individual entity _has_) becomes an ECS component. `PluginSystem`, `VariableStore`, and `ActorSystem`'s message-passing are process- or scene-global state, not per-entity data — they become typed `Game` services (same pattern as `game.audio`/`game.services` already established this pass), not entities with components. `UISystem`'s widget tree likely gets a root anchored to a `Transform` component, but the tree itself stays a tree — don't flatten it into one entity per widget just for uniformity.
- **Parity required before deletion.** For each ported system, write tests exercising the same real scenarios the old system's own tests cover (43 old test files to draw from) and confirm the new one behaves the same way, before removing the old implementation. Don't delete on faith.
- **Final layout: flatten `ecs/` back to the package root once the old code is gone.** `packages/engine/src/ecs/Entity.ts` → `packages/engine/src/core/Entity.ts` (matching this repo's own "core primitives go in `core/`" convention) or the package root, once there's no second implementation left to segregate it from. `@emptysock/engine/ecs` as a subpath retires in favor of plain `@emptysock/engine` once that happens — this is the very last step, only once every system is ported and parity-checked and the old code is actually deleted, not something to do partway through.

**Four more, settled 2026-09-22, same session:**

- **Unify `IDEBridge` and `QueryChannel` into one bridge, as part of this port, not a follow-up.** `IDEBridge`'s whole reason to exist is talking to the old `Scene`/`Entity`; once that's gone, fold its push-style live-snapshot behavior into (or replace it with) `QueryChannel` rather than leaving the IDE with two overlapping live-connection code paths.
- **Delete `core/ObjectPool.ts`.** `Scene.spawn`/`.destroy`'s built-in `{ pool: true }` pooling already covers what it was for. Before deleting, confirm nothing non-entity-shaped (raw Pixi textures, particle-system buffers) is quietly relying on it for something `Scene`-level pooling doesn't cover — if something like that turns up, keep a narrower pooling utility for that specific non-entity case, don't keep `ObjectPool` wholesale just in case.
- **`@emptysock/vn`/`battle`/`tilemap` are in scope, not frozen.** `VNTextbox`/`CharacterStage` call into the old `UISystem` today; when `UISystem` gets ported, their calls need to move with it. Treat the module packages as real consumers of whatever's being ported, same as `apps/ide` and the toolchain — they were split out of the engine this pass, that doesn't mean their internals stop changing.
- **Fix the Inspector's schema lookup to be `ComponentRegistry`-driven, once everything's ported.** It currently reads from a small hand-maintained map of hardcoded components (a known, already-documented limitation from this pass). Once every system's components are real registered `ComponentDef`s, the Inspector can enumerate what's actually registered instead of needing a hand-maintained import list — do this once the precondition (everything's ECS-native) is actually true, not before.

---

## Context for whoever picks this up next

**Framing note (2026-09-22):** this file and `CLAUDE.md` used to describe the
engine as having a "v1" and "v2" — an older pre-existing set of systems and a
newer bitECS-backed core, referred to by that shorthand throughout several
passes' worth of notes below. There was never a shipped, released version
this superseded; that was always internal shorthand for two things that
coexist in the same current engine for real architectural reasons (the
ECS-backed entity/component core, alongside older singleton-style systems
such as `PluginSystem`, `AudioSystem`, and the original
`core/Entity.ts`/`Scene.ts`). The historical entries below (largely
completed work, kept for the record) still use the old "v1"/"v2" shorthand
in places; read it as "the ECS core" vs. "the existing singleton-style
systems," not as two versions of the engine. New entries going forward
should describe systems by what they are, not by a version label.

**Rename note (2026-09-22):** the ECS-backed core's literal directory,
`packages/engine/src/v2/`, and its `@emptysock/engine/v2` subpath export,
have since been renamed to `packages/engine/src/ecs/` and
`@emptysock/engine/ecs` respectively — the "staying as-is" call in the
previous paragraph no longer holds; every `.../v2/...` path and
`@emptysock/engine/v2` specifier below is a historical reference to the
pre-rename layout, not the current one.

The IDE bug fixes and Track 0 of the `ENGINE_DESIGN.md` implementation plan are
done and merged to this branch (`claude/adoring-dirac-4tiv8c`). Durable decisions
from that work are migrated into `CLAUDE.md`'s "Non-obvious decisions" section
(the rc-dock anchor-tab docking fix, the Monaco ambient-module-declaration fix).
Read in this order:

1. **`ENGINE_DESIGN.md`** (repo root) — the locked engine spec. §22 is the
   readiness table; §23 is the most recent round. Track 0 (Entity/Component
   core wrapping bitECS, Game/Scene lifecycle, the Serializable constraint,
   the headless testing harness) is implemented at `packages/engine/src/v2/`
   and `packages/engine/src/testing/` — a subpath export, alongside the
   existing systems at the package root (`packages/engine/src/core/` etc.),
   which keep running unmodified; every other system still runs on them.
2. **This file's open items below** — Tracks 1, 2, and X of the
   `ENGINE_DESIGN.md` implementation, now that Track 0 is real. Track 1 items
   are independent of each other and can run as separate parallel sessions.
   Track 2 depends on Track 1 substantially landing (mainly rendering + the
   frozen core API), except `@emptysock/network` which only needs Track 0.
   Track X is fully independent of `packages/engine` and can run anytime.
3. **`CLAUDE.md`** — describes the engine as it actually is today, as one
   current system (see the framing note above). Non-obvious decisions about
   the ECS core under `v2/` are documented there directly, alongside every
   other system, with no version label attached.

---

## Current pass — implementing `ENGINE_DESIGN.md`, Tracks 1/2/X

**Read `ENGINE_DESIGN.md` §9 and §22 before starting anything**, plus the
ECS core itself at `packages/engine/src/v2/` — every Track 1/2 item below
builds on that API (`defineComponent`, `entity.get`/`.add`, `scene.spawn`/
`.each`, `Game.loadScene`/`.unloadScene`), not on the older `core/Entity.ts`/
`Scene.ts`.

### Track 1 — parallel, independent of each other, depends only on Track 0 (done)

- [x] **Physics.** Done — `v2/components/PhysicsBody.ts` (data component +
      `getPhysicsBody()` callback-handle wrapper), `v2/systems/PhysicsSystem.ts`
      (2D, wired into `Game.update()` steps 3/4 and `loadScene`/`unloadScene`
      lifecycle) and `v2/systems/PhysicsSystem3D.ts` (3D, ported from v1's
      handle-based API, not ECS-wired — see its file doc for why). Fixed
      timestep + `interpolationAlpha`/`getInterpolatedTransform` per §10.3;
      `Game.create({ deterministic: true })` swaps in
      `@dimforge/rapier{2,3}d-deterministic-compat` (added as
      `optionalDependencies`) per §15.2. Deviation: PhysicsSystem3D is not
      auto-wired into `Game`'s lifecycle (`SceneLifecycle` only has one
      physics slot) — a 3D game constructs/owns it directly. Tests in
      `src/__tests__/v2/physics.test.ts`.
- [x] **Rendering.** Done — `v2/components/Transform.ts`/`Sprite.ts` (ported
      1:1 onto `defineComponent`; all-numeric plus two `string` fields, no
      side-table needed for the component itself) and
      `v2/systems/RenderPipeline.ts` (reuses v1's `RenderSystem`/`LayerSystem`
      unchanged, syncs via `scene.each` per §21, WebGL-default per §18).
      `Game.loadOverlay`/`unloadOverlay` (§12.3, stack in call order, own
      `ActorSystem`, inert `PhysicsSystem` by default) plus
      `Game.attachRenderer`/`detachRenderer` wire the real render step into
      `Game.update()`'s step 7 — main scene then overlays, on top, in call
      order; a no-op with no renderer attached or under `headless: true`.
      Deviation: `RenderPipeline` keeps sprite tracking in a
      `Map<Scene, ...>` (not the raw entity-id map v1 used), since overlay
      scenes' bitECS worlds independently reuse the same `eid`s as the main
      scene — see the `Sprite.ts`/`RenderPipeline.ts` doc comments for the
      full rationale. Tests in `src/__tests__/v2/RenderPipeline.test.ts` and
      `src/__tests__/v2/overlay.test.ts`.
- [x] **Input + Audio.** `v2/Input.ts`'s `InputManager` (game-owned, not
      scene-owned) gives `input.isDown("action")` action-mapping over
      `input.keyboard`/`input.gamepad(n)`/`input.touches` raw escape hatches
      (§15.3); `Game.update()` step 1 now calls `input.snapshot()` first,
      unconditionally, freezing device state for the rest of that frame.
      `game.audio`/`SceneLifecycle.audio` wires v1's `AudioSystem`
      (Howler-backed, unchanged) onto `Game` as a persistent singleton — no
      per-entity audio component exists in v1 to migrate, so no
      `defineComponent` work was needed here. See CLAUDE.md's "Input
      snapshot: frozen by copy, not by timing" and "Audio stays a
      Game-owned singleton" entries for the durable rationale.
- [x] **Services + Save system.** Typed `game.services` registry (§5);
      `SaveSystem` with automatic per-runtime-target backend (IndexedDB/Tauri
      fs) and the per-component `migrate()` hook (§19.3) — build on the
      `Serializable` constraint already landed at `v2/Serializable.ts`.
      Landed: `v2/Services.ts` (`Game.services`, a `ServiceRegistry`
      instance for the `Game`'s lifetime) and `v2/systems/SaveSystem.ts` +
      `StorageAdapter.ts`. Deviation: storage backend selection is an
      injectable `StorageAdapter` interface (mirrors `Transport`), not a
      `window`/Tauri runtime check inside the engine — IndexedDB/Tauri-fs
      adapters get built and injected by the host, per-component
      `version`/`migrate()` added as an optional 3rd arg to
      `defineComponent` (defaults to version 1, non-breaking). See
      CLAUDE.md's new "SaveSystem storage backend is an injected adapter,
      not a runtime check" entry.
- [x] **Scene/prefab file format.** `PrefabDef`/`definePrefab`/`flattenPrefab` + pooling folded into `Scene.spawn`/`.destroy` (`{ pool: true }`) land
      in `packages/engine/src/v2/{Prefab,Scene}.ts`; JSON parsing
      (`PrefabFile`/`SceneFile`/`parsePrefabFiles`/`loadSceneFile`) lands in
      `packages/engine/src/v2/SceneFile.ts` — runtime spawn-from-JSON is
      engine scope. The `.d.ts` codegen (`generatePrefabTypes`) is
      `packages/toolchain/src/prefabCodegen.ts` — pure offline codegen, no
      `Scene`/`World` involved, so it's toolchain scope; it reads real
      `ComponentDef`s (for field types JSON can't carry) via the same
      `ComponentLookup` type `SceneFile.ts` uses, and only needs an
      explicit `PrefabDef<T>` type param at the codegen boundary (a
      `__props` phantom field) to give `scene.spawn(prefab, props)` real
      inference. Follow-up, not done here: wiring `generatePrefabTypes`
      into an actual IDE auto-save hook or a `cli.ts` build command — the
      function is real/tested/exported, the two call sites aren't wired.

### Track 2 — depends on Track 1 substantially landing (mainly rendering + the frozen core API)

- [x] **Visual scripting.** `packages/engine/src/systems/VisualScriptCompiler.ts`
      compiles a `VisualScriptGraph` (the existing v1 shape the Visual Script
      Editor's Logic Script tab authors — `VariableStore`/`ActorSystem` calls,
      not entity/component ones, since that's what the graph format actually
      models) into literal JS calling `VariableStore`/`ActorSystem` directly
      (`ctx.variables.setVar(1, 5)`, `ctx.actorSystem.send("target", {...})`),
      not a generic node interpreter re-implementation. `VisualScriptComponent`
      (the interpreter) is kept, not replaced — it's still the default,
      compiling is opt-in via the new `CompiledVisualScriptComponent`, a
      drop-in with the same public shape. Tests compile a representative
      graph slice, check `ts.transpileModule` diagnostics, and — the one that
      actually proves §12.2 — eval the emitted code and assert it produces
      identical `VariableStore`/`ActorSystem` side effects to the interpreter
      for the same graph. IDE wiring (an "Export Compiled JS" button next to
      the existing "Export Code" one) is a noted follow-up, not done here.
- [x] **Module packages.** Split VN/Story Graph, battle system, and
      tilemap/navmesh into their own `@emptysock/<module>` packages (§13.1).
      Landed: `packages/vn` (`VNSystem`, `VNScriptConvert`'s
      `storyGraphToDialogueTree`/`dialogueTreeToStoryGraph`, `VNTextbox`,
      `VNBackgroundLayer`), `packages/battle` (`BattleSystem`), and
      `packages/tilemap` (`TilemapSystem`/`Tilemap`, `NavMeshSystem`) —
      each a `workspace:*` dependant of `@emptysock/engine`, never the other
      way around. `@emptysock/engine`'s `index.ts` no longer exports any of
      these; `RenderPipeline` (which still needs to mount a tilemap) depends
      on a new structural `TileLayerSource` interface it exports instead of
      importing `Tilemap` from `packages/tilemap`, keeping the engine ->
      module-package dependency arrow one-directional. `apps/ide`'s
      `VNEditor.tsx` now imports `storyGraphToDialogueTree`/
      `dialogueTreeToStoryGraph` from `@emptysock/vn`. Tests that exercised
      two of these systems together moved to whichever package already
      depended on both: the BattleSystem half of `GameE2E.test.ts` moved to
      `packages/battle/src/__tests__/BattleGameLoop.test.ts`; the
      RenderPipeline+Tilemap mounting tests moved to
      `packages/tilemap/src/__tests__/RenderPipelineIntegration.test.ts`.
      Visual scripting's package split is a **deliberate remaining
      follow-up**, not an oversight — scoped out of this pass per its own
      note above (needs to be sequenced after visual scripting's compilation
      work lands). Per-template package declaration (a scaffolded game
      project's `package.json` listing only the module packages its
      `--template` needs) is future toolchain work, since template
      scaffolding itself isn't built yet. `docs/reference/`,
      `docs/manual/`, and the `emptysock-ai-skills` skill files still
      describe VN/Battle/Tilemap/NavMesh as part of `@emptysock/engine` —
      updating them is deferred to the docs pass per that pass's own
      instructions, not done here.
- [x] **`@emptysock/network`.** Colyseus integration, bridged through the
      same `.get()` Proxy layer (§23.2) — only needs Track 0's core API
      (done), does **not** need physics/rendering, so this can start now.
      Landed: new `packages/network` workspace package wrapping
      `colyseus.js` 0.16 (`getStateCallbacks`/`$(instance).listen`, verified
      against current Colyseus docs). `networked(componentDef, fields)`
      marks fields by the same `componentName` string `ComponentRegistry`
      keys on; `NetworkSystem` binds a room's `MapSchema` collection,
      mapping Colyseus network ids to local `Entity` handles via
      `entity.rawId` (never touches bitECS internals — all reads/writes go
      through `entity.get(Component)`). Outbound sync is a per-`sync()`-call
      dirty-check poll, not a proxy-set intercept, matching §23.2's "not the
      thousands-of-entities-at-60fps case" cost model. Tests mock the
      client-side schema-callback shape (no official client-side Colyseus
      test harness exists, only server-side room helpers).
- [x] **MCP live bridge — engine side.** `packages/engine/src/v2/bridge/QueryChannel.ts`
      is the v2-aware query/command channel §8 calls for — a separate, narrower
      thing from `core/IDEBridge.ts` (that stays a v1 `postMessage` broadcast;
      `QueryChannel` is a synchronous request/response call, `handle(query):
EngineQueryResult`, against a live v2 `Scene`/`PhysicsSystem`). It is
      transport-agnostic by design (same pattern as `Transport`/
      `StorageAdapter`): `@emptysock/engine` never touches a socket, only
      `attach(scene, physics)`/`detach()`/`handle(query)`. Supported query
      `kind`s: `listEntities`, `entityInfo`, `getComponent` (against component
      defs registered via `registerComponents(...)`), `raycast2d`,
      `overlapCircle2d`, `bodyState2d` — the shapes the three previously-stubbed
      `emptysock-mcp` tools (`physics_raycast_2d`, `physics_overlap_circle`,
      `physics_body_state`) plus entity/component reads and scene listing need.
      `PhysicsSystem` gained the underlying `raycast`/`overlapCircle`/
      `getBodyState` primitives it wraps, plus a `PhysicsNotInitializedError`
      thrown when there's no world at all. Every query result is
      `{ ok: true, data }` or `{ ok: false, error: { code, message } }` with
      three distinct error codes — `"no-live-instance"` (nothing attached),
      `"no-physics-world"` (scene attached, no initialized `PhysicsSystem`),
      `"not-found"`/`"unknown-component"` — kept deliberately distinct from a
      real empty/`null` result (§8: "no fabricated answer"). See the TSDoc on
      `QueryChannel` for the full contract. Tests:
      `packages/engine/src/__tests__/v2/query-channel.test.ts`.
      **Still open, separate repo/pass:** the `emptysock-mcp`-side relay —
      wiring an actual transport (WebSocket or the IDE's own bridge) that
      turns `EngineQueryRequest`/`EngineQueryResponse` traffic into calls
      against `QueryChannel.handle`, and rewriting the three stubbed tools
      plus adding entity/component-read and scene-listing tools to call it —
      was out of scope here (no `emptysock-mcp` checkout in this pass); build
      it against the shapes exported from `@emptysock/engine/v2`
      (`EngineQuery`, `EngineQueryRequest`, `EngineQueryResponse`,
      `EngineQueryResult`, `EngineQueryError`) rather than a mocked channel,
      since the real one now exists.

### Track X — fully independent of `packages/engine`, can run anytime, in parallel with everything above

- [x] IDE: schema-driven Inspector property panels reading each component's
      optional co-located schema (§10.1). **Done.** `defineComponent`'s new
      optional `schema` option (`packages/engine/src/v2/Component.ts`)
      attaches a `ComponentSchema<T>` to the returned `ComponentDef`, dogfooded
      on `Transform`/`Sprite`/`PhysicsBody`'s plain-data fields; a component
      with no schema is unaffected. `EntityProperties.tsx`'s `ComponentSection`
      looks a component's schema up by `componentName` and renders real typed
      controls (number/text input, checkbox, enum `<select>`) bound to the
      live entity's field, falling back to the pre-existing raw per-field text
      editor for any component or field with no schema entry.
- [x] Engine: component-shape-change hot reload messaging (§13.3). **Done.**
      `ComponentRegistry.ensure()` (`packages/engine/src/v2/ComponentRegistry.ts`)
      now detects a hot-swapped `defineComponent` re-registration whose field
      set or a field's default type changed (diffed against the _declared_
      defaults snapshotted at last registration, not live entity data — see
      the new CLAUDE.md entry), resets every entity on that world currently
      carrying the component to the new shape's defaults, and
      `console.warn`s a message naming the component, what changed, and how
      many entities were reloaded. Entities without the component, and
      same-shape hot-swaps, are unaffected. Tests:
      `packages/engine/src/__tests__/v2/component-shape-change.test.ts`.
- [x] IDE: "open in VS Code" launch button, not deep theme/extension import
      (§20). **Done.** Toolbar button (`apps/ide/src/components/panels/Toolbar.tsx`)
      calls `VsCodeService.openInVsCode()`
      (`apps/ide/src/services/VsCodeService.ts`). Tauri desktop: a new
      `open_in_vscode` command in `lib.rs` shells out to `code <path>` via
      plain `std::process::Command` (no shell-plugin scope needed). Browser
      preview: honest about the real limitation — the File System Access
      API only exposes a directory handle's `name`, never a real OS path,
      so there's nothing for a `vscode://file/<path>` URI to point at in
      that mode; the button surfaces that explanation and points at the
      desktop app instead of silently no-oping. Tests:
      `apps/ide/src/__tests__/VsCodeService.test.ts` (Tauri success/failure,
      browser-with-real-path building the URI, browser-without-real-path
      showing the message).
- [x] Toolchain: move the CLI's real export/build to Rolldown (§16.3/§17,
      migrate this one before the IDE's in-browser path). **Done.** The
      only real Node-side bundling call site was
      `packages/toolchain/src/desktopBuild.ts`'s desktop export step
      (`emptysock-toolchain export --platform windows|mac|linux`); it now
      calls the real `rolldown` npm package instead of `esbuild`, extracted
      into a standalone `bundleGameEntry()` for testing without a
      Rust/`cargo tauri` toolchain (`packages/toolchain/src/__tests__/desktopBuild.test.ts`).
      Rolldown has no `esbuild`-style `drop: ["console"]`/`target` build
      options; the equivalent (`minify.compress.dropConsole`,
      `minify.compress.target`) lives under its Oxc-backed `minify` option
      instead — same behaviour, different option shape, not a regression.
      `apps/ide`'s in-browser `esbuild-wasm`/`GameBuildService` live-preview
      build path was deliberately left untouched per §17's sequencing (a
      separate future spike) — nothing under `apps/ide/src/services/` was
      touched by this change.
- [x] Toolchain: GMS2 importer audit — confirm every documented 2.3+ import
      path is wired end-to-end, not stubbed anywhere in the chain (§9 — no
      scope change, just an audit). **Done.** Traced every quirk in
      CLAUDE.md's GMS2 section through `packages/toolchain/src/gms2-import.ts`
      (+ `gms2-sprite-import.ts`, `gms2-room-import.ts`) and confirmed each
      is implemented and covered by
      `packages/toolchain/src/__tests__/gms2-import.test.ts`: trailing-comma
      stripping (`parseGmsJson`), `.yyp` root `"%Name"`, `Collision_<obj>`/
      `KeyPress_<vk>`/`KeyRelease_<vk>` event files emitting
      `onCollideWith<Other>`/`onKeyPress<Name>`/`onKeyRelease<Name>` (37-40
      correctly map to Left/Up/Right/Down), room layers keyed by
      `resourceType` not `layerType`, sprite frames resolved to their own
      UUID-named PNG (never `<sprite>.png`, with a clear throw when the PNG
      is missing on disk), and `defaultScriptType: 1` correctly _not_
      producing a warning on its own (confirmed via a new test — see below).
      All four §9-named chains (events, room layers, sprites, action-list
      transpilation) are wired end-to-end: parse → transform → an actual
      written `.ts`/`.sprite.ts`/room-scene file, not stubbed partway
      through. No bugs found in already-implemented logic (the vk-code
      arrow-key map is correct as documented). - **New follow-up flagged, not fixed (out of this audit's scope):**
      `packages/toolchain/src/gms2-gml-stub.ts` (`generateObjectStub`) and
      `packages/toolchain/src/gms2/gmlStubConverter.ts`
      (`gmlObjectToTypeScript`/`gmlObjectDirToTypeScript`) are a second,
      unwired GMS2-object-to-TypeScript implementation — exported from
      `packages/toolchain/src/index.ts` but never called by `cli.ts`'s
      actual `import --from gms2` path (which only calls
      `importGMS2Project` from `gms2-import.ts`) and never referenced by
      any test. Same shape as the already-documented "export-utils has no
      desktop packaging path" situation. See new Track X bullet below. - **Test coverage strengthened:** added two regression tests to
      `gms2-import.test.ts` — one asserting `defaultScriptType: 1` alone
      produces no "GML Visual" warning on a project whose events are all
      real text `.gml` files, and one asserting legacy GameMaker 8.1
      DnD-compat symbols (`action_move`, `gml_pragma`) pass through the
      transpiler untranspiled/verbatim rather than being faked. Existing
      tests already used realistic trailing-comma fixtures, so no change
      was needed there.
- [x] Repo-wide: adopt changesets (§20) before the module-package split
      (Track 2) creates more packages to version by hand. Done:
      `access: restricted` (every package, including the new
      `@emptysock/{vn,battle,tilemap}` split from Track 2, is still
      `private: true` with no npm publish config found anywhere), `ignore:
["@emptysock/ide"]` (it's the Tauri app, not a published package —
      the workspace glob `packages/*` already auto-discovers every other
      package, split or not, with no extra config needed). No version
      bumps were made; root scripts `changeset`/`version`/`release` added.
- [ ] **Newly discovered follow-up (GMS2 importer audit, not fixed here —
      needs its own dedicated pass):** remove or wire up the second, unwired
      GMS2-object-to-TypeScript implementation in
      `packages/toolchain/src/gms2-gml-stub.ts` (`generateObjectStub`) and
      `packages/toolchain/src/gms2/gmlStubConverter.ts`
      (`gmlObjectToTypeScript`/`gmlObjectDirToTypeScript`). Neither is called
      by `cli.ts`'s real `import --from gms2` path (only
      `gms2-import.ts`'s `importGMS2Project` is), and neither has a test —
      they're dead/duplicate code still publicly exported from
      `packages/toolchain/src/index.ts`. Decide whether to delete them
      (matching the precedent set by the export-utils desktop-packaging
      cleanup) or actually wire one of them in; don't leave a public export
      that silently does nothing in the real CLI flow.
- [x] Docs: scaffold the TypeDoc + typedoc-plugin-markdown pipeline (§19.1)
      — can start against v1 code now and simply point at v2 code once it
      exists, rather than waiting. Done: `typedoc` +
      `typedoc-plugin-markdown` installed at the repo root; root
      `typedoc.json` uses `entryPointStrategy: "expand"` with entry points
      globbed as `packages/*/src/index.ts` so new workspace packages (e.g.
      the VN/battle/tilemap split) are picked up automatically; `pnpm run
docs:generate` runs it. Verified: it runs clean (no errors) against
      today's real packages (engine, types, toolchain, network, battle,
      tilemap, vn, export-utils) and produces correct Markdown pages with
      real class/method signatures, falling back sensibly on exports that
      have no TSDoc yet.
      **Update — now live:** per explicit user authorization to generate
      and commit the mechanical, auto-generated TypeDoc pages specifically
      (everything else about the docs/skills pass remains deferred, see
      below), `typedoc.json`'s `out` now points at `docs/reference/api/` —
      a distinctly-named subdirectory, not `docs/reference/` directly,
      because several hand-written pages there (`scene.md`, `entity.md`,
      `component.md`, …) would otherwise collide on filename with
      TypeDoc's own output. The `docs/reference-generated/` gitignore
      entry and scratch README are removed; `docs/reference/index.md`
      gained one link pointing into `docs/reference/api/README.md`, with
      no other hand-written content touched. `docs/reference/api/` is
      excluded from Prettier (`.prettierignore`) so regeneration doesn't
      produce reformatting noise. `pnpm run docs:generate` is confirmed
      idempotent (re-running produces a byte-identical tree).
- [x] **Docs pass for `emptysock-engine`, deferred above, is now done.**
      `docs/getting-started/`, `docs/guides/`, `docs/reference/` (hand-written
      pages only, `docs/reference/api/` untouched), `docs/architecture.md`,
      `docs/troubleshooting.md`, and `docs/glossary.md` now describe the real
      v2 API surface (`@emptysock/engine/v2`, `@emptysock/engine/testing`) and
      the four new module packages, alongside the unchanged v1 content. New
      pages: `docs/getting-started/whats-new-v2.md`,
      `docs/guides/entities-and-scenes-v2.md`, `docs/reference/v2-core.md`.
      `docs/manual/`, `ai/CLAUDE.md`, `ai/api-reference.json`, and
      `emptysock-ai-skills` are a separate sibling pass, not covered here.
- [x] **Voice pass extended to the rest of `docs/`.** The friendlier tone from
      the v2 docs pass above now also covers the pages that pass deliberately
      left untouched because their systems didn't change: `docs/guides/physics.md`,
      `input-and-gamepad.md`, `saving-and-localisation.md`, `navigation.md`,
      `actors-and-networking.md`, `plugins.md`, `building-and-exporting.md`,
      `hot-reload.md`, `docs/language-reference.md`,
      `docs/getting-started/{your-first-game,ide-tour,installation,from-gamemaker}.md`,
      and `docs/reference/{scene,entity,component}.md`. Each page with a real
      v2 alternative or moved package now has a short "Heads up" callout near
      the top pointing at the right new page (`v2-core.md`,
      `entities-and-scenes-v2.md`, or `whats-new-v2.md`) — content and API
      descriptions themselves are untouched, this was prose-and-cross-reference
      only. `docs/reference/api/` and `docs/manual/` still untouched, same as
      before.

---

## Code quality pass (apps/ide/src review findings)

- [x] Inspector component metadata (Finding 1): merged `EntityProperties.tsx`'s
      two hand-maintained maps (`V2_COMPONENT_SCHEMAS` + `componentColor`)
      into one `V2_COMPONENT_METADATA: Record<string, ComponentInspectorMeta>`
      map, so a new component needs one entry, not two. Chose the
      co-located-map-in-`apps/ide` alternative over extending `ComponentDef`
      in `packages/engine/src/v2/Component.ts` because that file (and
      `PhysicsBody.ts`) were being actively edited by a sibling agent in this
      same shared working directory at the time.
- [x] `EngineChannel.ts` dead code (Finding 2): removed the unused, duplicate
      `sendToEngine(iframe, msg)` method (zero callers); `useEngineChannel.ts`'s
      own `sendToEngine` wrapper now calls `engineChannel.postToEngine(msg)`.
- [x] postMessage boundary validation (Finding 3): added `isEntitySnapshot`,
      a hand-written runtime type guard validating every `EntitySnapshot`
      field, plus stricter checks for `es:component-fields`; malformed
      messages are dropped with a `console.warn` instead of passing through.
- [x] `@emptysock/network`/`SaveSystem`/`Prefab` review findings:
  - Stale entity mapping (real bug): `NetworkSystem.reconcile()` (called
    automatically at the top of `sync()`) polls every tracked `Entity`'s
    `.isAlive` and drops the mapping for any that were destroyed locally
    (not via Colyseus `onRemove`), so a recycled `rawId` can no longer
    silently alias a stale network mapping. See CLAUDE.md's new
    "`@emptysock/network`'s field-marking and entity-mapping scheme"
    addendum.
  - Component metadata precedent (consistency, not a bug): added CLAUDE.md's
    new "Per-component metadata: on `ComponentDef` if the engine needs it,
    in the add-on package's own side-map if only that package needs it"
    entry — no code changed, `SaveSystem.version` and `networked()`'s
    side-map are both kept as-is.
  - `SaveSystem.load()` unknown-field validation (real bug):
    `packages/engine/src/v2/systems/SaveSystem.ts` now filters a saved
    component's `data` keys against `Object.keys(def.createDefaults())`
    before calling `entity.add()`, dropping and warning on any field not
    part of the component's declared shape instead of injecting it
    unchecked. Test: `services-save.test.ts`'s "drops unrecognized fields
    injected into a saved component's data" case.
  - `Scene.spawn()` unmatched prop-key validation (real bug):
    `packages/engine/src/v2/Scene.ts` now warns (naming the prefab and the
    unmatched field(s)) when a `props` key doesn't match any field on the
    prefab's components, instead of silently dropping it — catches a typo
    like `{ helth: 10 }` without failing the rest of the spawn. Test:
    `prefab.test.ts`'s "warns on an unmatched prop key" case.
  - Colyseus cast consolidation (refactor, no behaviour change): added
    `getCollection`/`getSchemaProxy` typed accessors to
    `packages/network/src/colyseusTypes.ts`; `NetworkSystem.ts`'s
    `_bindCollection`/`_spawnFromSchema` call sites use them instead of
    hand-rolling an `as unknown as {...}` cast inline each time.
  - `networked()` in-place-mutation limitation (documentation only, not
    fixed): added a doc comment on `networked()` in
    `packages/network/src/NetworkedFields.ts` stating that a networked
    field mutated in place (rather than reassigned) is never detected as
    dirty by `NetworkSystem.sync()`'s strict-equality check — deep-equality
    change detection was explicitly out of scope for this pass.

---

## Code quality pass — `packages/toolchain/src/` review findings

- **Finding 1 (module split):** `gms2-import.ts` (was 780 lines doing four
  jobs) split into `gms2-parse.ts` (JSON pre-parsing/`YYProject` types),
  `gms2-transpile.ts` (GML→TS pattern transpiler), `gms2-codegen.ts`
  (per-asset-kind object/sprite/room/script stub codegen), and
  `gms2-report.ts` (migration-report formatting). `gms2-import.ts` is now a
  thin orchestrator that imports from all four. `parseGmsJson` is
  re-exported from `gms2-import.ts` for backward compatibility with the
  existing test import. No behavioural change — all pre-existing
  `gms2-import.test.ts` tests pass unchanged.
- **Finding 2 (pure report function):** `migrationReport` moved to
  `gms2-report.ts` and rewritten as a pure function over a plain
  `MigrationReportEntry[]` (`{kind, name, status, note?}`) built by
  `importGMS2Project` from the actual import results, instead of being
  interleaved with the per-asset-kind I/O loops. Added
  `packages/toolchain/src/__tests__/gms2-report.test.ts` — four tests
  exercising `migrationReport` with hand-built fixtures, no filesystem
  touched.
- **Finding 3 (static imports):** `cli.ts`'s three ad hoc
  `await import("child_process")`/`await import("util")`/`await
import("path")`/`await import("fs")` blocks (in the `import` action,
  `exportZip`, and `zipDirectory`) hoisted to static top-of-file imports
  (`node:child_process`, `node:util`, `node:path`, `node:fs`), matching the
  rest of the file. No behavioural change.
- **Finding 4 (Rolldown minify option shape — verified correct, no fix
  needed):** checked `desktopBuild.ts`'s `bundleGameEntry` minify options
  directly against `node_modules/.pnpm/rolldown@1.2.7/.../dist/shared/binding-DZuNHVw4.d.mts`.
  `OutputOptions.minify?: boolean | "dce-only" | MinifyOptions`;
  `MinifyOptions.compress?: boolean | CompressOptions` where
  `CompressOptions` has `target?: string | Array<string>` and
  `dropConsole?: boolean`; `MinifyOptions.mangleProps?:
ManglePropertiesOptions` is a **sibling** of `compress` (not nested
  inside it) and `ManglePropertiesOptions.include` is a required `RegExp`.
  The existing code's shape — `{ compress: { target, dropConsole },
mangleProps: { include: /regex/ } }` — matches this exactly. Verdict:
  correct as written, left unchanged.
- Ran `tsc --noEmit`, `eslint`, and the full `packages/toolchain` vitest
  suite (35/35 passing, including `desktopBuild.test.ts`) after all
  changes above. The monorepo-wide `turbo run test` could not be run to
  completion in this pass: `@emptysock/engine`'s build step currently fails
  (`RenderPipeline.test.ts` type errors on a `destroyed`/`parent` property)
  due to a concurrent sibling session's in-progress, uncommitted changes to
  `packages/engine` in this same shared working directory — unrelated to
  `packages/toolchain` and outside this pass's scope.

---

## Code quality pass — `packages/vn`/`packages/battle`/`packages/tilemap` review findings

- **Finding 1 (VNSystem's `variableStore` default, documented not removed):**
  Added a doc comment directly on `VNSystem`'s constructor in
  `packages/vn/src/VNSystem.ts` explaining that the default parameter
  shares the engine's process-global `variableStore` singleton across
  every caller that doesn't pass an explicit store, and a matching
  "Non-obvious decisions" entry in `CLAUDE.md`. No behaviour change — the
  default itself is kept for backward compatibility.
- **Finding 2 (config drift across `packages/{vn,battle,tilemap}`):**
  Added `tsconfig.module-package.json` (repo root) with the shared
  module-package compiler options; `battle`/`tilemap`/`vn`'s own
  `tsconfig.json` now extend it and keep only their genuinely
  package-relative options (`outDir`/`rootDir`/`typeRoots`/`include`).
  Added `vitest.config.module-package.mts` (repo root, `.mts` so Vite's
  native config loader doesn't warn about ESM-in-CJS given the root
  `package.json` has no `"type": "module"`) exporting
  `moduleTestPackageDefaults()`/`withModulePackageDefaults()`; all three
  packages' `vitest.config.ts` now call the former instead of duplicating
  the same `defineConfig({...})` block. Investigated the `vn`/tilemap
  `lib` array discrepancy specifically: `vn`'s `VNTextbox.ts` genuinely
  calls `document.createElement("canvas")`, so its `["ES2024", "DOM",
"DOM.Iterable"]` override is real and was kept (now as a documented,
  commented override on top of the shared `["ES2024"]` base) — it was not
  copied unnecessarily. `packages/network` was left untouched (same shape,
  but out of this pass's scope) and its full suite (`tsc`/`eslint`/vitest)
  was re-verified passing against the new shared vitest config file it
  does _not_ use, to confirm no regression. Package.json script-field
  templating was judged not worth doing in this pass (the four packages'
  `build`/`typecheck`/`lint`/`test`/`clean` scripts are already identical
  one-liners; a `packages/_template/` would add more indirection than it
  saves right now) — noted here as the deferred option per the review.
- **Finding 3 (`BattleSystem.ts` decomposition):** Split
  `packages/battle/src/BattleSystem.ts` (798 lines) into `CombatantState.ts`
  (the shared internal record type), `TurnOrder.ts` (`computeTurnOrder`),
  `StatusEffects.ts` (`applyStatusEffects`, `effectiveStats`), and
  `DamageResolution.ts` (`DEFAULT_PHYSICAL`, `resolveTargets`,
  `executeAction`, `executeSkill`). `BattleSystem.ts` itself is now the
  thin orchestrator — round/phase state machine, combatant maps, event
  subscription — composing the four modules; its public API
  (`start`/`submitAction`/`subscribe`/`getPhase`/`getRound`/`getCombatant`/
  everything exported from `packages/battle/src/index.ts`) is byte-for-byte
  unchanged. Split `BattleSystem.test.ts` the same way: added
  `TurnOrder.test.ts`, `StatusEffects.test.ts`, and
  `DamageResolution.test.ts` as focused unit tests exercising the new
  modules directly; the original `BattleSystem.test.ts` (767 lines,
  entirely orchestration/public-API level already) was left as-is since it
  was already scoped correctly. All 25 pre-existing `BattleSystem.test.ts`
  assertions pass unchanged against the refactored orchestrator.
- No other pre-existing bugs (beyond style) were found in
  `packages/vn`/`packages/battle`/`packages/tilemap` while doing this pass.
- Ran `tsc --noEmit`, `eslint`, and the full vitest suite for
  `packages/vn` (18/18), `packages/battle` (54/54, up from 29 pre-split),
  `packages/tilemap` (11/11), and `packages/network` (7/7) — all passing
  after every change above.

---

## Code quality pass — engine v2 core fixes

Architecture + thermo-nuclear code review of `packages/engine/src/v2/`
(physics/rendering/lifecycle files) surfaced two confirmed correctness bugs
plus several structural-duplication findings. All fixed in one pass:

- **Bug 1 (stale `PhysicsBody` callbacks/handles leak onto reused pooled
  entities):** Merged `PhysicsBody.ts`'s two side-tables
  (`callbacksByWorld`/`handleCache`) into one
  `WeakMap<World, Map<eid, { callbacks, handle }>>`, and added
  `clearPhysicsBody(world, eid)`, called from `Scene.destroy()` for both the
  pooled-reset and real-destroy paths — the one place that already knows
  "this entity's component data is being reset/removed" regardless of which
  components were attached. Regression test:
  `src/__tests__/v2/physics.test.ts` — spawn pooled entity A with a
  collision callback, destroy it, spawn pooled entity B reusing the same
  slot, assert B gets no callback and a fresh handle.
- **Bug 2 (`RenderPipeline`'s main-scene sprite tracking wasn't scoped
  per-`Scene`, unlike overlay tracking):** Folded `_mainTracking` into the
  same `Map<Scene, SceneTracking>` overlays already use; `_syncMain` now
  tracks which `Scene` it currently belongs to and fully disposes the
  previous one's sprites (reusing the same per-sprite teardown
  `releaseOverlay` uses) the moment a different `Scene` is passed in.
  Regression test: `src/__tests__/v2/RenderPipeline.test.ts` — "Bug 2
  regression" — load scene A with a sprite at a given eid, swap to scene B
  with a different sprite at the same eid, assert B's sprite is shown, A's
  tracking is gone, and A's Pixi sprite is actually destroyed/detached.
- **Finding 3 (duplicated fixed-timestep accumulator/interpolation):**
  Extracted `v2/systems/FixedTimestepAccumulator.ts`
  (`FixedTimestepAccumulator` + `lerpSnapshot`), used by both
  `PhysicsSystem.ts` (2D) and `PhysicsSystem3D.ts`. `lerpSnapshot` takes a
  caller-supplied `lerpFn` so 2D (lerps x/y/rotation) and 3D (lerps x/y/z,
  passes rotation through unlerped) both fit without forcing one shape.
- **Finding 4 (copy-pasted WeakMap-per-World get-or-create):** Added
  `v2/internal/scoped.ts` (`getOrCreate`/`getOrCreateMapEntry`), used by
  `ComponentRegistry.ts`, `PhysicsBody.ts`'s merged side-table, and
  `RenderPipeline.ts`'s scene tracking/overlay containers.
- **Finding 5 (`Game.update()`'s overlay loop hand-duplicating the main
  scene's per-frame logic) + Finding 7 (`LoadOverlayOptions.physics`
  constructed a world nothing ever stepped):** Added a `physicsEnabled` flag
  to `Game.ts`'s internal `LoadedScene` and a shared `runFrame(loaded, dt)`
  function (flush actor mailbox, step physics if `physicsEnabled`, call
  `onUpdate` with the async-Promise check) used by both the main scene and
  every overlay in `update()`. This is a real behavior change for Finding 7:
  an overlay loaded with `loadOverlay(def, { physics })` now actually has
  its physics stepped every frame, not just constructed-and-initialized and
  left for the caller to drive manually. Regression test:
  `src/__tests__/v2/overlay.test.ts` — "Finding 7" — a body on an overlay
  loaded with `physics` falls under gravity across `game.update()` calls
  with no manual `physics.update()` call from the test.
- **Finding 6 (`Entity.add()`/`createComponentProxy`/`ComponentRegistry`
  each reimplementing "write field at index, growing the array"):** Added
  `v2/internal/fields.ts` (`setField`/`setFields`), used by all three sites.
- **Finding 8 (`QueryChannel`'s throwaway per-query proxy cache had no
  doc):** Added a doc comment on `QueryChannel._entityHandle` explaining the
  per-call scratch cache is intentionally never shared with the live game's
  own proxy identity — no structural change, per the review's own
  instruction not to "fix" this, just document it.
- New tests: `src/__tests__/v2/shared-helpers.test.ts` covers
  `FixedTimestepAccumulator`/`lerpSnapshot`/`getOrCreate`/
  `getOrCreateMapEntry`/`setField`/`setFields` directly. All pre-existing
  `PhysicsSystem`/`RenderPipeline`/`Game`/overlay tests pass unchanged
  (internals-reaching assertions in `RenderPipeline.test.ts` were updated
  to read the renamed `_tracking` map, not `_mainTracking`/
  `_overlayTracking` — same observable behavior, different internal field
  names).
- No other pre-existing behavioral bugs were found while in these files
  beyond the two named above.
- Ran `tsc --noEmit`, `eslint`, and the full vitest suite for
  `packages/engine`: 57 test files, 462 tests, all passing. No flaky
  failures observed (none needed a rerun-in-isolation).

---

## Starting a new pass

All prior work is on `main` in each repo. Create a new branch from `main` in each repo at the start of the next pass.

---

## Framing-correction pass (2026-09-22)

- [x] Dropped "v1"/"v2" version framing from `CLAUDE.md`, `RELEASE_PASS.md`
      (this file's context section above), `docs/`, and code/doc comments
      across the monorepo — this was always internal shorthand for "the
      ECS core" vs. "the older singleton-style systems," never a real
      shipped version 1.0 that got superseded. The literal `packages/engine/src/v2/`
      directory and `@emptysock/engine/v2` subpath export are unchanged
      (a real breaking-API-surface rename, out of scope). Renamed
      `docs/getting-started/whats-new-v2.md` → `docs/getting-started/engine-overview.md`,
      `docs/guides/entities-and-scenes-v2.md` → `docs/guides/entities-and-components.md`,
      `docs/reference/v2-core.md` → `docs/reference/core-api.md`, with every
      cross-reference and the nav table in `docs/README.md` updated.
      Bumped every package's `version` from `0.1.0` to `0.2.0` across the
      monorepo, reflecting accumulated engine maturity, not a semver signal.

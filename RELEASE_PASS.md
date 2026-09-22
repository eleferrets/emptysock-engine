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

## The pass: make the ECS core the one engine, delete everything else

**Decided with the project owner on 2026-09-22, before any of this is implemented. Read this whole file before writing code or launching a sub-agent.**

The engine currently has two real, different object models living side by side: the ECS core at `packages/engine/src/ecs/` (bitECS-backed, `entity.get(Component)`/`scene.each()`, versioned entity IDs, currently covers only physics, sprite/transform rendering, save, and a query bridge) and the original `Scene`/`Entity`/`Component` at `packages/engine/src/core/` plus 32 systems under `packages/engine/src/systems/` (class-based, `entity.getComponent("Name")` keyed by a type string). This was a deliberate, incremental choice by the original design spec — not a mistake — but it is not where the engine ends up.

**The ECS core becomes the one real API. Every old system gets ported onto it or deleted. The old class-based `Scene`/`Entity`/`Component` goes away entirely.** Scope is everything: this repo's code, this repo's docs (`docs/`, `docs/manual/`, `docs/architecture.md`, every guide), `emptysock-ai-skills` (every skill file, `ai/CLAUDE.md`, `ai/AGENTS.md`, `ai/.cursorrules`, `ai/api-reference.json`), and `emptysock-mcp` (tool contracts and docs). Nothing old gets left behind anywhere, in code or in docs, in any of the three repos. This is a full redo, not a patch — expect a multi-session rewrite with a lot of real deletion at the end of it, not a quick pass.

**Documentation changes are last, across all three repos, full stop.** Don't touch `docs/`, `emptysock-ai-skills`, or `emptysock-mcp`'s docs until every code track below is done, parity-checked, and the old code is deleted. Writing docs against code that's still being ported means rewriting the docs again once the port's real final shape settles — wait until it's real.

---

## Ground rules (settled, don't re-litigate)

These were worked through explicitly with the project owner. If a session hits a moment that feels like it's re-deciding one of these, it's misreading the rule, not finding a real exception — stop and re-read this section.

1. **Versioned entity IDs stay as a real guarantee.** A stale `Entity` handle to something destroyed must fail loudly, not silently alias onto a newly-spawned entity. Native to the ECS core already — nothing extra to build for it, just don't lose it while porting something else.
2. **Audit real usage before porting or deleting anything.** Don't assume the directory listing below is gospel by the time you read it, and don't assume a system is load-bearing just because it exists. Check real callers first (Track 0 does this for the whole list up front; re-check narrowly for your own track before you start).
3. **Rollout is system by system, never a big-bang cutover.** Port one system, update its real consumers, verify it, move to the next. The old `Scene`/`Entity` stays alive and working for whatever hasn't been ported yet. `apps/ide` and the toolchain must never be broken mid-pass — every commit should leave a working engine.
4. **Not everything becomes a component.** Only genuinely per-entity data (something one specific entity _has_) becomes an ECS component. Process- or scene-global state (`PluginSystem`, `VariableStore`, `ActorSystem`'s message-passing) becomes a typed `Game` service instead (the same pattern already established for `game.audio`/`game.services`), not entities with components. A widget tree (`UISystem`) gets a root anchored to a `Transform` component, but the tree itself stays a tree — don't flatten UI into one entity per widget just for uniformity.
5. **Parity required before deleting the old implementation of anything.** For each ported system, write tests exercising the same real scenarios the old system's own tests cover (43 old test files to draw from — use them as your scenario list, don't invent a thinner set) and confirm the new one behaves the same way. Don't delete on faith.
6. **Final layout: flatten `ecs/` back to the package root once the old code is gone.** `packages/engine/src/ecs/Entity.ts` → `packages/engine/src/core/Entity.ts` (or the package root, matching this repo's "core primitives go in `core/`" convention) once there's no second implementation left to segregate it from. `@emptysock/engine/ecs` retires as a subpath in favor of plain `@emptysock/engine`. This is the very last code step, only once everything is ported, parity-checked, and deleted — never partway through.
7. **Unify `IDEBridge` and `QueryChannel` into one bridge**, as part of this pass, not a follow-up. `IDEBridge` exists to talk to the old `Scene`/`Entity`; once that's gone, fold its push-style live-snapshot behavior into (or replace it with) `QueryChannel`.
8. **Delete `core/ObjectPool.ts`.** `Scene.spawn`/`.destroy`'s built-in `{ pool: true }` already covers what it was for. Confirm nothing non-entity-shaped (raw Pixi textures, particle buffers) quietly relies on it for something `Scene`-level pooling doesn't cover before deleting — if something like that turns up, keep a narrower pooling utility for that specific case, don't keep `ObjectPool` wholesale just in case.
9. **`@emptysock/vn`/`battle`/`tilemap` are in scope, not frozen.** `VNTextbox`/`CharacterStage` call into the old `UISystem` today; when `UISystem` gets ported, their calls move with it. Treat the module packages as real consumers, same as `apps/ide` and the toolchain.
10. **Delete `core/NetworkActor.ts`/`Transport.ts`.** A second, separate networking primitive alongside `@emptysock/network` is exactly what a full redo shouldn't preserve. If actor messages ever need a networked variant, that's `@emptysock/network`'s job.
11. **Scene transitions are open for redesign, not just a straight port.** `SceneManager`'s current overlay-based transitions (a rect fading/wiping/sliding on top of whatever's rendering, not a true two-scene crossfade) were a deliberate, reasoned tradeoff. Since `RenderPipeline` is being rewritten anyway, reconsider whether a true two-scene crossfade is worth doing now.
12. **Physics determinism stays opt-in, non-deterministic stays default.** This was never about the old-vs-new object model — it's an independent performance/correctness tradeoff that applies the same regardless of which object model physics sits on. Carry it forward unchanged.
13. **Fix the Inspector's schema lookup to be `ComponentRegistry`-driven** once every component is real and registered (Track 8, sequenced after the systems that produce most of the IDE's inspectable components have landed). It currently reads a small hand-maintained map of a handful of hardcoded components — a known, already-documented limitation. Don't do this early; the precondition (everything's ECS-native) has to actually be true first.
14. **Redesign the MCP tool contracts to match the ECS API directly**, not just repoint their implementation. `scene_get_component`'s framing should mirror `entity.get(ComponentDef)`/`ComponentRegistry`'s real, name-keyed shape once that's the actual engine underneath. Real work in `emptysock-mcp`, done as part of this scope, in the docs-last phase alongside its other doc/contract work.
15. **GMS2 import targets the prefab/scene JSON format, not generated TypeScript classes.** A GameMaker object maps onto a prefab; a room maps onto a scene file — both are already real JSON formats in this engine. Stop emitting `class X extends Scene`.
16. **Delete `CLAUDE.md` entries once the system they describe is gone.** `CLAUDE.md` documents what's actually running, not a changelog — remove entries outright once they no longer apply to any real code, don't mark them historical.
17. **Bump every package to 1.0.0 once the whole redo is genuinely done** — code, docs, skills, and MCP tools all landed, parity-checked, old code deleted. Not a mid-pass bump.

---

## What's actually being ported — real consumer counts, as of 2026-09-22

Verified by grep against this branch on 2026-09-22 — **re-verify before trusting a number**, code moves between sessions. "Other files reference it" counts every file across `packages/` and `apps/` mentioning the system's name outside its own source/tests, so it includes both real call sites and incidental mentions (comments, re-exports) — treat it as a rough signal for "how entangled is this," not a precise call-site count. Track 0's job is to turn this rough signal into a real per-system decision.

| System               | Refs | Notes from this session's spot-check                                                                                                                                                                                                                                                                                                                                                            |
| -------------------- | ---: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `InputSystem`        |   26 | Heavily referenced; also the live backing store `ecs/Input.ts`'s `InputManager` already wraps for its frozen-snapshot behavior — check whether this needs a real port or just confirmation it's correctly used as an internal implementation detail behind `InputManager`, not a second public surface.                                                                                         |
| `VariableStore`      |   23 | Becomes a `Game` service per ground rule 4. Heavily used by `@emptysock/vn`'s `VNSystem` (see CLAUDE.md's "VNSystem defaults to the engine's global `variableStore` singleton" entry) — that coupling needs to survive the port, not just get carried forward unexamined.                                                                                                                       |
| `RenderSystem`       |   24 | Old low-level renderer under `RenderPipeline`. Likely folds into the ECS `RenderPipeline`'s internals rather than needing its own separate port.                                                                                                                                                                                                                                                |
| `LayerSystem`        |   22 | Keyed by raw entity id, no scene scoping (see CLAUDE.md's existing note on why overlay sprites skip it). Real redesign candidate, not a mechanical port — the ECS `RenderPipeline` already had to invent its own per-`Scene` tracking specifically because this doesn't scope correctly.                                                                                                        |
| `UISystem`           |   19 | Widget tree. Per ground rule 4, root anchors to a `Transform` component, tree stays a tree. Real, substantial port — this is not a small system.                                                                                                                                                                                                                                                |
| `GamepadSystem`      |   15 | Same nuance as `InputSystem` — check whether it's already correctly used as `InputManager`'s internal backing store.                                                                                                                                                                                                                                                                            |
| `PostProcessSystem`  |   15 | Feeds `RenderPipeline.renderTransitionOverlay` today (see CLAUDE.md's scene-transitions entry) — tied to ground rule 11's scene-transition redesign question.                                                                                                                                                                                                                                   |
| `CameraSystem`       |   14 |                                                                                                                                                                                                                                                                                                                                                                                                 |
| `ViewportSystem`     |   14 |                                                                                                                                                                                                                                                                                                                                                                                                 |
| `CustomShaderFilter` |   10 |                                                                                                                                                                                                                                                                                                                                                                                                 |
| `InputBindings`      |    9 | Action-mapping config layer. Candidate to fold directly into `ecs/Input.ts`'s `InputManager` rather than staying a separate system — confirm during Track 0's audit.                                                                                                                                                                                                                            |
| `LightingSystem`     |    9 |                                                                                                                                                                                                                                                                                                                                                                                                 |
| `SequenceSystem`     |    9 |                                                                                                                                                                                                                                                                                                                                                                                                 |
| `AutoTileSystem`     |    8 | **Not dead** — confirmed still a real, load-bearing dependency of the existing `RenderPipeline.mountTilemap()` (`autoTile?: AutoTileSystem` parameter). Do not delete on the old suspicion it was redundant; it needs a real port, and it interacts with `@emptysock/tilemap`'s `Tilemap`/`TileLayerSource` boundary — check how.                                                               |
| `CGGallery`          |    8 | **Not dead** — confirmed a real IDE feature (`apps/ide/src/components/panels/CGGallery.tsx`, `apps/ide/src/store/cgStore.ts`), backing CG-unlock tracking for visual novels. Real port, not a deletion.                                                                                                                                                                                         |
| `CoroutineSystem`    |    8 | Backs `Entity.startCoroutine()` — the old `Entity`'s own coroutine method. Needs an ECS-native equivalent (likely `entity.startCoroutine()` on the ECS `Entity` proxy) before any system relying on coroutines can be considered fully ported.                                                                                                                                                  |
| `MapEventSystem`     |    8 |                                                                                                                                                                                                                                                                                                                                                                                                 |
| `PathfindingSystem`  |    8 | Check whether this belongs in core (`packages/engine`) at all once ported, or whether it should move to `@emptysock/tilemap` alongside `NavMeshSystem`/`AStarSearch`, matching the precedent that navigation-shaped systems live there now.                                                                                                                                                     |
| `WindowSystem`       |    8 |                                                                                                                                                                                                                                                                                                                                                                                                 |
| `AssetManifest`      |    7 |                                                                                                                                                                                                                                                                                                                                                                                                 |
| `ParticleSystem`     |    7 |                                                                                                                                                                                                                                                                                                                                                                                                 |
| `TweenSystem`        |    7 |                                                                                                                                                                                                                                                                                                                                                                                                 |
| `CharacterStage`     |    5 | **Not dead** — confirmed real, used by `@emptysock/vn`'s VN-rendering path (`VNBackgroundLayer`/`VNTextbox` territory). Check whether this should port into core `@emptysock/engine` or move into `@emptysock/vn` alongside the rest of the VN-specific rendering it already serves — it may belong there more than in core, unlike `AutoTileSystem`/`CGGallery` which read as general-purpose. |
| `DebugOverlaySystem` |    5 |                                                                                                                                                                                                                                                                                                                                                                                                 |
| `HotReloadSystem`    |    5 | Distinct from `ComponentRegistry`'s existing shape-change detection (already ECS-native, documented in CLAUDE.md) — this is the code-hot-swap side, not the data-reset side. Confirm the two compose correctly once both are in play.                                                                                                                                                           |
| `LocalisationSystem` |    5 | Likely a `Game` service, same reasoning as `VariableStore`/`PluginSystem`.                                                                                                                                                                                                                                                                                                                      |
| `PointerSystem`      |    5 |                                                                                                                                                                                                                                                                                                                                                                                                 |

**Already have ECS-side counterparts, verify coverage rather than assuming it's complete:** `VisualScriptCompiler`, `AudioSystem` (service, not component — see CLAUDE.md), `PhysicsSystem`/`PhysicsSystem3D`, `RenderPipeline` (sprite/transform only — the whole point of most of the render-side rows above is extending it), `SaveSystem`.

**Old `core/` primitives, not in the systems count above:** `Actor.ts`/`ActorSystem.ts` (already wired into `ecs/Game.ts`'s lifecycle as-is, per CLAUDE.md — confirm this is the final shape, likely little to no porting work, just verification), `PluginSystem.ts` (→ `Game` service, ground rule 4), `SceneManager.ts` (scene transitions, ground rule 11), `NetworkActor.ts`/`Transport.ts` (delete, ground rule 10), `ObjectPool.ts` (delete, ground rule 8), `IDEBridge.ts` (unify into `QueryChannel`, ground rule 7), `AStarSearch.ts` (pairs with `PathfindingSystem`'s tilemap-vs-core question above), `EngineAPI.ts`, `HostAdapterSlot.ts`, `GPUTier.ts`, `easing.ts` (likely low-risk utility ports, sweep these in whichever track touches their real consumer).

**Real consumers outside `packages/engine` that need to move with whatever they depend on, not just get recompiled:**

- `apps/ide` — 23 files import the old root `@emptysock/engine` API (Inspector, panels, preview bridge, `IDEBridge`). Re-validate the live-preview/editing story end to end as each underlying system's track lands, not just once at the very end.
- `packages/toolchain`'s GMS2 importer generates `class X extends Scene` — real redesign per ground rule 15, sequenced with Track 7.
- `@emptysock/vn`/`battle`/`tilemap` call into several of the systems above (`UISystem` via `VNTextbox`/`CharacterStage` at minimum) — move with whatever they depend on, per ground rule 9.

---

## Tracks

Numbered for reference, not strict sequence — dependencies are called out explicitly per track. Each track is meant to be a viable unit of work for one session or one parallel agent; track descriptions are intentionally verbose so a session picking one up doesn't need to re-derive scope from the tables above.

### Track 0 — Audit and foundational services (sequential, blocks every other track, do not parallelize)

- [ ] **Real-usage audit.** Turn the rough reference-count table above into a real per-system decision: port into core, port into a module package (`@emptysock/vn`/`tilemap`/etc.), fold into an existing system as an internal implementation detail (the `InputSystem`/`GamepadSystem`/`InputBindings` → `InputManager` question), or confirm-and-keep-as-is (`ActorSystem`). Write the decision and its reasoning into this file's per-track checklists below before any porting work starts, so later tracks aren't guessing.
- [ ] **`PluginSystem` → `Game` service.** Per ground rule 4. Same typed-registry pattern as `game.services`/`ServiceRegistry` already established.
- [ ] **`VariableStore` → `Game` service.** Per ground rule 4. Check `@emptysock/vn`'s `VNSystem` constructor default (`variableStore` singleton, documented in CLAUDE.md) survives the move with the same sharing semantics, since that coupling is explicit, documented, and intentional today.
- [ ] **`LocalisationSystem` → `Game` service**, same reasoning.
- [ ] **`ActorSystem` verification, not a port.** Confirm it's already correctly wired into `ecs/Game.ts`'s lifecycle as a `Game`-owned system (per CLAUDE.md, it already is) and that this is the intended final shape — if so, this is a documentation/confirmation task, not implementation work.
- [ ] **Unify `IDEBridge` into `QueryChannel`.** Ground rule 7. Foundational because `apps/ide` needs one working live-connection story across the whole rest of this pass, not two half-overlapping ones that both need maintaining while everything else moves.
- [ ] **`CoroutineSystem` → ECS-native `entity.startCoroutine()`.** Needed before any later track can port a system that relies on coroutines internally.
- [ ] **Delete `core/NetworkActor.ts`/`Transport.ts`.** Ground rule 10 — no dependencies, safe to do immediately once confirmed nothing calls it.
- [ ] **Delete `core/ObjectPool.ts`.** Ground rule 8 — verify the non-entity-pooling exception doesn't apply first.

### Track 1 — Input (parallel once Track 0 lands)

- [ ] Resolve the `InputSystem`/`GamepadSystem`/`InputBindings` question from Track 0's audit: fold into `ecs/Input.ts`'s `InputManager` as pure internal backing store (no separate public surface), or give them real independent ECS-side ports. High reference counts (26/15/9) but likely already mostly correct as `InputManager`'s internals — this may be a smaller track than the numbers suggest once Track 0's audit resolves it.
- [ ] Parity tests against the old systems' 43-test corpus for whatever input behavior is covered there.

### Track 2 — Rendering pipeline extension (parallel once Track 0 lands; internally sequential, these systems depend on each other)

- [ ] `RenderSystem` — likely folds into `ecs/systems/RenderPipeline.ts`'s internals.
- [ ] `LayerSystem` — real redesign, not a mechanical port (see the reference-table note on why raw-eid keying doesn't scope correctly, same problem `RenderPipeline`'s own per-`Scene` tracking already had to solve once).
- [ ] `CameraSystem`, `ViewportSystem` — likely coupled to each other and to render-frame timing.
- [ ] `PostProcessSystem`, `CustomShaderFilter`, `LightingSystem` — render-pipeline extensions layered on top of the base sprite/transform rendering the ECS `RenderPipeline` already does.
- [ ] `AutoTileSystem` — confirmed real (see table), a real port, and needs its interaction with `@emptysock/tilemap`'s `Tilemap`/`TileLayerSource` structural-interface boundary worked out explicitly (does `AutoTileSystem` move into the engine core alongside `RenderPipeline`, or into `@emptysock/tilemap` alongside the rest of tile-related logic? — decide and document the reasoning, this is a real architectural call, not obvious either way).
- [ ] `WindowSystem` — check whether this is render-adjacent (viewport/window chrome) or belongs with Track 3's UI work; the table lists it under rendering by convention, verify.

### Track 3 — UI (parallel once Track 0 lands, depends on Track 2's `Transform`/render work being stable enough to anchor a UI root to)

- [ ] `UISystem` — the widget tree. Real, substantial work (19 references). Root anchors to a `Transform` component per ground rule 4; the tree itself stays a tree, not flattened into per-widget entities.
- [ ] `DebugOverlaySystem` — debug UI, likely a thin consumer of whatever `UISystem` becomes.
- [ ] `CGGallery` — confirmed real (see table), backs the IDE's CG-unlock tracking feature. Port it for real.
- [ ] `PointerSystem` — input-meets-UI (hit testing, drag/click dispatch against the widget tree) — sequence after `UISystem`'s real shape is settled, not before.

### Track 4 — Animation and FX (parallel once Track 0 and Track 2 land)

- [ ] `TweenSystem`, `SequenceSystem`, `ParticleSystem`, `MapEventSystem` — check real interdependencies between these during Track 0's audit before assuming they're independent; `SequenceSystem` in particular may drive the other three.

### Track 5 — Navigation and character-stage systems (parallel once Track 0 lands)

- [ ] `PathfindingSystem` — resolve during Track 0's audit whether this belongs in `packages/engine` core or moves to `@emptysock/tilemap` alongside `NavMeshSystem`/`AStarSearch`, matching that precedent.
- [ ] `CharacterStage` — confirmed real (see table), used by `@emptysock/vn`. Resolve during Track 0's audit whether this ports into core or moves into `@emptysock/vn` alongside the VN-rendering work it already serves closely.
- [ ] `AssetManifest` — likely a `Game`-level or toolchain-level service rather than per-entity; low reference count (7), shouldn't be a large track on its own, consider folding into whichever adjacent track picks it up rather than running it standalone.

### Track 6 — `SceneManager` and scene transitions (parallel once Track 2's `RenderPipeline` work is stable)

- [ ] Port `SceneManager`'s scene-transition timing logic onto the ECS `Game`/`Scene` lifecycle.
- [ ] Resolve ground rule 11: decide whether to keep the current overlay-based transition behavior or build a true two-scene crossfade now that `RenderPipeline` is being rewritten anyway. Document the decision and reasoning either way.

### Track 7 — Toolchain: GMS2 importer redesign (depends on the ported systems it targets being stable — likely one of the later tracks to finish, since it needs real `ComponentDef`s for whatever GML-derived behavior maps onto, and stable prefab/scene JSON shapes)

- [ ] Redesign GMS2 import to emit prefab/scene JSON instead of `class X extends Scene` TypeScript, per ground rule 15. GameMaker objects → prefabs (components + defaults); rooms → scene files.
- [ ] Re-verify every documented GMS2 quirk (trailing commas, `%Name`, event naming, `resourceType` room layers, sprite frame UUIDs, `defaultScriptType`, untranspiled GM8.1 DnD symbols — see CLAUDE.md's GMS2 section) still holds against the new output shape; these are format facts about GameMaker's real export data, independent of the engine's object model, and must not regress.

### Track 8 — IDE Inspector: `ComponentRegistry`-driven schema lookup (sequenced last among code tracks, needs most other tracks' `ComponentDef`s to exist first)

- [ ] Replace the Inspector's hand-maintained component-metadata map with a real `ComponentRegistry`-driven enumeration, per ground rule 13. Only do this once enough of the above tracks have landed that "every component is ECS-native" is actually true, not aspirational.

### Track 9 — Deletion pass (sequential, the last code track, depends on every other code track being done and parity-checked)

- [ ] Confirm zero remaining references anywhere in the monorepo to `packages/engine/src/core/` and `packages/engine/src/systems/`'s old contents.
- [ ] Delete the old `core/`/`systems/` trees.
- [ ] Flatten `packages/engine/src/ecs/` back to the package root per ground rule 6.
- [ ] Full monorepo `typecheck`/`lint`/`test` pass — must be as clean as every prior verification in this pass's history.
- [ ] Bump every package to `1.0.0` per ground rule 17 — this is the actual trigger condition, not a calendar date.

### Track 10 — Documentation, full redo, all three repos (last, no exceptions, starts only once every code track above is done)

Do not start this track until Track 9 is fully checked off. Writing docs against code that hasn't reached its final shape means doing this twice.

- [ ] `emptysock-engine`: `docs/getting-started/`, `docs/guides/`, `docs/reference/` (hand-written pages — the generated `docs/reference/api/` TypeDoc tree regenerates mechanically, just re-run it), `docs/architecture.md`, `docs/troubleshooting.md`, `docs/glossary.md`, `docs/manual/` — full rewrite describing the one, real, post-port engine. No "what used to be" framing anywhere.
- [ ] `emptysock-engine`: `CLAUDE.md` — remove every entry describing a now-deleted system per ground rule 16; write new entries for whatever non-obvious decisions this pass actually produced (there will be several — the `UISystem`/`LayerSystem` redesigns alone are likely to produce real ones).
- [ ] `emptysock-ai-skills`: every skill file, `ai/CLAUDE.md`, `ai/AGENTS.md`, `ai/.cursorrules`, `ai/api-reference.json` — full rewrite for the one API.
- [ ] `emptysock-mcp`: finish ground rule 14's tool-contract redesign (if not already done as part of Track 0/1's `QueryChannel` work) and rewrite `README.md`'s tool table and `CLAUDE.md` to match.
- [ ] Final full-repo verification across all three repos (typecheck/lint/test where applicable, link/cross-reference checks for docs) before calling the pass done.

---

## Starting the next pass

Read this whole file before writing any code or launching a sub-agent. Create a new branch from `main` in each repo (`emptysock-engine`, `emptysock-ai-skills`, `emptysock-mcp`) at the start. Track 0 is sequential and blocks everything — do it first, in one session, before parallelizing Tracks 1–6.

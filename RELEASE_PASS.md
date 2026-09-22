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

**Scope is everything, confirmed explicitly 2026-09-22: this is a full redo, not a patch.** Every companion repo is in scope too — `docs/`, `docs/manual/`, `docs/architecture.md`, the guides, `emptysock-ai-skills` (skills + `ai/CLAUDE.md`/`AGENTS.md`/`.cursorrules`/`api-reference.json`), and `emptysock-mcp`'s tools all get fully rewritten to describe and target the post-port engine, not patched around the edges. Nothing old gets left behind anywhere, in code or in docs.

**Four more structural decisions, settled 2026-09-22, same session:**

- **Delete `core/NetworkActor.ts`/`Transport.ts`.** This is a second, separate networking primitive (actor-model message-passing over a network) alongside `@emptysock/network` (Colyseus-backed component replication). Two overlapping networking stories is exactly what a full redo shouldn't preserve — if actor messages ever need a networked variant, that's `@emptysock/network`'s job, not a second `Transport` interface in `core/`.
- **Redesign the MCP tool contracts to match the ECS API directly**, not just repoint their implementation. `scene_get_component`'s framing should mirror `entity.get(ComponentDef)`/`ComponentRegistry`'s real, name-keyed shape once that's the actual engine underneath, rather than describing a `Scene`/`Entity` concept that no longer exists. This is real work in `emptysock-mcp`, not a follow-on — do it as part of this same full-redo scope, not a later pass.
- **GMS2 import targets the prefab/scene JSON format, not generated TypeScript classes.** A GameMaker object maps onto a prefab (components + defaults); a room maps onto a scene file — both already exist as real JSON formats in this engine. Stop emitting `class X extends Scene`; emit prefab/scene JSON plus real registered `ComponentDef`s for GML-derived behavior, dogfooding the JSON pipeline on real external data instead of generating code against a type that won't exist anymore.
- **Delete `CLAUDE.md` entries once the system they describe is gone — don't keep them as annotated history.** `CLAUDE.md` documents what's actually running, not a changelog. Once "Component types as identity keys," "One ActorSystem per scene" (as currently implemented), and every other entry describing old, now-deleted systems no longer applies to any real code, remove the entry outright rather than marking it historical.

---

**Four more, settled 2026-09-22, same session:**

- **Old historical journal cleared.** This file used to carry a long, dated log of completed passes (the v1/v2 framing correction, the rename to `ecs/`, Track 0/1/2 implementation notes) below this brief. That's all done work, already reflected in the code and in `CLAUDE.md` where it's still durable — cleared per this file's own stated purpose (scratch space for the pass in flight, not a permanent changelog). If you need that history, it's in this branch's git log.
- **Scene transitions are open for redesign, not just a straight port.** `SceneManager`'s current overlay-based transitions (a rect fading/wiping/sliding on top of whatever's rendering, not a true two-scene crossfade) were a deliberate, reasoned tradeoff, but since `RenderPipeline` is being fully rewritten anyway as part of this pass, reconsider whether a true two-scene crossfade (keeping both scenes' sprites live simultaneously during the transition) is worth doing now rather than carrying the overlay-only limitation forward unexamined.
- **Bump every package to 1.0.0 once the whole redo is genuinely done** — code, docs, skills, and MCP tools all landed, parity-checked, old code deleted. Not a mid-pass bump; the milestone is "one real engine, one real API, nothing legacy left in the tree," not any individual system's port finishing.
- **Physics determinism stays opt-in, non-deterministic stays default.** This was never about the old-vs-new object model — it's a real, independent performance/correctness tradeoff (SIMD-optimized build vs. bit-for-bit reproducibility) that applies the same regardless of which object model physics sits on. Carry it forward unchanged; the port itself isn't a reason to revisit it.

---

## Starting the next pass

Read the brief above in full before writing any code. Create a new branch from `main` in each repo (`emptysock-engine`, `emptysock-ai-skills`, `emptysock-mcp`) at the start.

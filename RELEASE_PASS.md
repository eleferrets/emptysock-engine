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

## Context for whoever picks this up next

Two sessions happened on this branch (`claude/happy-ritchie-br08vq`, merged to
`main`). Read in this order:

1. **`ENGINE_DESIGN.md`** (repo root) — a from-scratch v2 engine redesign spec,
   12 review rounds, ~34 architectural decisions, every load-bearing external
   library claim checked against real research (not assumed) and revised at
   least three times when checking surfaced something better than the first
   guess (Rapier's deterministic build variant, `@rolldown/browser` for the
   in-browser build, bitECS's real array-based data shape and entity-recycling
   behavior). Section 22 is a table mapping every decision to its section —
   read that first for orientation, then follow section references as needed.
   **Status: design is locked. Nothing in it has been implemented yet** —
   `packages/engine` today is still the v1 engine described in `CLAUDE.md`'s
   "Non-obvious decisions." The two items below are what's left before
   implementation starts.
2. **This file's open items below** — one real v1 IDE bug found during a
   usability audit (not a v2 design question, but worth fixing in the same
   window since v2's module-package split makes it worse), and the
   parallelization plan for implementing `ENGINE_DESIGN.md`.
3. **`CLAUDE.md`** — still accurate for the _current_ (v1) engine and IDE.
   Do not edit it to describe v2 shapes until real v2 code lands; it should
   keep describing what's actually running until it isn't.

---

## Current pass — open items (v1 bugs, not v2 design)

- [x] **Enabling a module beyond the default set spawns it as a floating window overlapping the center panels, instead of docking into its tab group.** Fixed: `openPanelInLayout` in `apps/ide/src/App.tsx` always called `layout.dockMove(factory(), null, "float")` for a not-yet-present tab; it now docks via `layout.dockMove(factory(), anchorId, "middle")` against an existing tab in the module's group ("canvas" for main-panel modules, "assets" for bottom-panel modules), falling back to float only if the anchor tab is missing. Disabling a module now also removes its tab via a new `closePanelInLayout`. Reproduced live: Window → Modules... → check every module → Escape → reload (module list isn't read at `DEFAULT_LAYOUT`-build time otherwise, since `DEFAULT_LAYOUT` is a module-scope constant computed once from `enabledModules` at that time) → the newly-enabled `CG Gallery` panel (and likely others among the 9 gated tabs that never rendered as real dock tabs in the same test) appears as an undocked floating window pinned at a fixed screen position, directly on top of the Code editor and every other center/bottom panel, persisting across tab switches. Root cause not yet isolated — candidates: `buildDefaultLayout()`'s `getModuleTabs` only being consulted at that one-time module-scope evaluation, so a module toggled afterward has no slot reserved in the live `LayoutData` and rc-dock falls back to floating it; or a `dockbox`/`floatbox` handling gap for tabs added post-init. **Fix before starting `ENGINE_DESIGN.md` §13.1's module-package split lands in the IDE** — a beginner enabling the VN module for a VN template should never see this.
- [x] **Every `@emptysock/engine` call in the Code tab shows a false "Property X does not exist" / "Cannot find module" squiggle.** Fixed: `engineTypesPlugin` in `apps/ide/vite.config.ts` now flattens `packages/engine/dist-types` into one `declare module "@emptysock/engine" { ... }` ambient block (internal relative imports rewritten to synthetic `@emptysock/engine/__internal/<path>` ambient module names), fed to Monaco's `addExtraLib` in place of the per-file relative-path extra libs. Verified with a standalone `typescript` language-service harness (not the real Monaco worker, which isn't drivable headless here): TS2792 is gone, `GameScene extends Scene` resolves `createEntity`/`addTag`/`getEntities` with zero diagnostics, and a genuinely-missing method still correctly reports TS2339. Root cause confirmed live (F8 → marker text) on `GameScene.ts extends Scene`: Monaco reports `TS2792: Cannot find module '@emptysock/engine'` on the import line, then treats `Scene` as an error type, so every inherited method call (`createEntity`, `addTag`, `getEntities`, ...) reports `Property 'X' does not exist on type 'GameScene'`. `apps/ide/vite.config.ts`'s `engineTypesPlugin` feeds `packages/engine/dist-types/**/*.d.ts` into Monaco as `addExtraLib` entries at `file:///node_modules/@emptysock/engine/...`, but the bundled Monaco TypeScript worker (`monaco-editor@0.56`'s `languages/features/typescript/register.d.ts`) only exposes `ModuleResolutionKind.Classic | NodeJs` — no `NodeNext`/`Bundler` — and apparently still can't resolve the bare specifier `@emptysock/engine` from extraLibs alone. Tried and **ruled out** as a full fix: (1) stripping the `.js` extensions dist-types emits on relative specifiers (necessary for Classic/NodeJs resolution, but not sufficient on its own), (2) injecting a synthetic `file:///node_modules/@emptysock/engine/package.json` extra lib with `types`/`main` pointing at `index.d.ts` (TS2792 persisted even with this in place). Next thing to try: synthesize one flattened `declare module "@emptysock/engine" { ... }` ambient block instead of relative-file + package.json resolution. **Note for whoever picks this up:** once `packages/engine`'s v2 rewrite starts, re-test this against the new API shape before spending time on it — the fix approach (ambient module block) is the same either way, but there's no point fixing it against types that are about to be replaced. Fix it now only if IDE work needs a working Code tab in the meantime.

---

## Next pass — implementing `ENGINE_DESIGN.md`

**Read `ENGINE_DESIGN.md` §9 and §22 before starting anything.** §9 already
locks the pass order (core engine → IDE → MCP → docs/skills); what follows
splits _within_ that order to identify what can run as separate, parallel
agent sessions versus what's strictly sequential.

### Track 0 — sequential, blocks everything else, do not parallelize further

One session, one PR (or a tight sequence of them). These decisions interlock
too much to split: the `.get()` Proxy wrapper (§21), the name-keyed component
registry that makes hot-reload work underneath bitECS's reference-based
identity (§23.1), and entity ID versioning (§23) all touch the same core
files, and `Game`/`Scene` lifecycle ownership (§4) is the thing every other
track spawns/destroys through.

- [x] `Entity`/`Component` core: wrap bitECS (§16.1, §21), enable versioned
      entity IDs by default (§23), build the name-keyed component registry
      (§23.1), implement `scene.spawn`/`entity.get`/`entity.add`/`scene.each`
      (§3, §11.3). Landed at `packages/engine/src/v2/` (`Entity.ts`,
      `Component.ts`, `ComponentRegistry.ts`, `Scene.ts`), built directly on
      the real `bitecs` npm package with `createEntityIndex(withVersioning())`
      — versioning is on unconditionally, not exposed as an option. `.get()`
      returns a cached-per-(entity,component) `Proxy`; `.each()` uses a
      separate no-Proxy accessor-based cursor over the raw arrays instead
      (faster than `.get()`, matching §21's stated reason `each` exists).
      Deviation: `defineComponent(name, defaults)` (a name-keyed factory)
      replaces the class-based `Component` sketched in §3's prose examples —
      chosen because it makes the §23.1 stable-name requirement the only way
      to define a component, rather than an easy-to-forget convention on top
      of a class declaration; runtime behaviour is unchanged either way.
      Deviation: this v2 core lives at a new `@emptysock/engine/v2` subpath
      export, not the package root — replacing `core/Entity.ts`/`Scene.ts`/
      `Component.ts` in place would have broken every other system
      (`PhysicsSystem`, `RenderPipeline`, `TilemapSystem`, `NavMeshSystem`,
      `PostProcessSystem`, ...) that Track 1/2 haven't migrated yet; v1 keeps
      running unmodified at the package root in the meantime.
- [x] `Game`/`Scene` lifecycle: automatic `ActorSystem`/`PhysicsSystem`
      creation and teardown (§4), the fixed one-phase-per-frame update order
      (§4), the `manageLifecycle: false` escape hatch, `onUpdate` as a
      compile-time-only-in-TS type error with a JS runtime warning fallback
      (§10.2). Landed at `packages/engine/src/v2/Game.ts`. `loadScene()`
      constructs a `Scene`, a v1 `ActorSystem`, and a v1 `PhysicsSystem`
      (`.init()`ed) together and hands back all three; `unloadScene()`
      destroys the actor/physics systems unconditionally in a `finally`
      after `onUnload` runs, `manageLifecycle: false` skips that teardown
      and hands the raw instances back for the caller to own. `update(dt)`
      runs actor mailbox-flush-then-update, then `onUpdate(dt)`, matching
      steps 2 and 5 of §4's 7-step order; steps 1/3/4/6/7 (input snapshot,
      physics step + collision dispatch, camera resolve, render) are no-ops
      for now since they depend on systems Track 1 hasn't migrated onto the
      v2 core yet — the ordering and the hooks for them exist, wiring the
      real systems in is Track 1 work, called out in code comments.
      `defineScene(...)` is a typed constructor whose generic inference
      rejects a literal `async onUpdate` at compile time (a bare
      `SceneDefinition` object typed as `(dt: number) => void` would _not_
      actually catch this — TS's void-return contextual typing accepts any
      return type there, the same leniency that lets `array.forEach(async
    fn)` compile silently); `Game.update()` also runs the JS-facing
      runtime `.then` check independent of how the scene was defined.
- [x] `Serializable` type constraint on components (§14.1, needed by both
      save durability and scene/prefab files below). Landed at
      `packages/engine/src/v2/Serializable.ts` — `defineComponent`'s
      defaults factory is constrained to return a `SerializableRecord`
      (string/number/boolean/null/array/plain-object fields only, no
      functions, no class instances), so a component with a non-serializable
      field fails to compile at the `defineComponent` call site. Only the
      type constraint landed, as scoped — `SaveSystem` itself is Track 1.
- [x] Headless testing harness (§15.1) — land this _early_, not last; every
      other track should be able to write tests against it from day one.
      Landed at `packages/engine/src/testing/index.ts`, exported as
      `@emptysock/engine/testing`. `createHeadlessScene()` gives a bare v2
      `Scene` with no lifecycle wrapper; `createHeadlessGame()` gives a
      `Game` subclass that forces `headless: true` on every `loadScene` call
      so the render step is always a no-op, while `ActorSystem`/
      `PhysicsSystem` still run for real — spawn/get/add/each/actor
      messaging behave identically to a non-headless game, nothing draws.

### Track 1 — parallel once Track 0 lands, independent of each other

Each bullet is a plausible separate agent session / PR. None of these
depend on each other, only on Track 0.

- [ ] **Physics.** `PhysicsBody` component, `PhysicsSystem`/`PhysicsSystem3D`
      wrapping Rapier2D/3D, `onCollide` as a plain property (§6), fixed
      timestep + interpolation (§10.3), the opt-in deterministic build swap
      via `@dimforge/rapier{2,3}d-deterministic-compat` (§15.2/§23 audit).
- [ ] **Rendering.** `Sprite`/render components wrapping Pixi, `RenderPipeline`
      defaulting to the WebGL renderer (§18 audit finding), overlay scenes
      (`Game.loadOverlay`, §12.3).
- [ ] **Input + Audio.** Action-mapping input layer with raw per-device
      escape hatch (§15.3); Howler-backed audio wrapper (confirmed still
      correct, §18).
- [ ] **Services + Save system.** Typed `game.services` registry (§5);
      `SaveSystem` with automatic per-runtime-target backend (IndexedDB/Tauri
      fs) and the per-component `migrate()` hook (§19.3) — depends on the
      `Serializable` constraint from Track 0 but nothing else in Track 1.
- [ ] **Scene/prefab file format.** JSON scene/prefab files + generated
      `.d.ts` types (§13.4), flat-scene-plus-nestable-prefabs spawning
      (§11.2), pooling folded into `spawn`/`destroy` (§12.4).

### Track 2 — depends on Track 1 substantially landing (mainly rendering + the frozen core API)

- [ ] **Visual scripting.** Nodes compile to literal calls against the same
      public API Track 0/1 produced (§12.2) — needs that API stable first.
- [ ] **Module packages.** Split VN/Story Graph, battle system,
      tilemap/navmesh into their own `@emptysock/<module>` packages (§13.1).
      Each of these can itself be a further-parallel sub-track once rendering
      (VN, tilemap) and core (battle) have landed.
- [ ] **`@emptysock/network`.** Colyseus integration, bridged through the
      same `.get()` Proxy layer (§23.2) — only needs Track 0's core API
      frozen, does **not** need physics/rendering, so this can actually start
      as soon as Track 0 lands rather than waiting for Track 1.
- [ ] **MCP live bridge.** Engine-side query/command channel (§8, extends
      `core/IDEBridge.ts`) — the engine side needs Track 0 done and
      benefits from Track 1's physics landing (for raycast/overlap queries);
      the `emptysock-mcp`-side relay implementation can be built against a
      mocked channel in parallel and wired up once the real one exists.

### Track X — fully independent of `packages/engine`, can run anytime, in parallel with everything above

- [ ] Fix the two v1 IDE bugs above.
- [ ] IDE: schema-driven Inspector property panels reading each component's
      optional co-located schema (§10.1); "open in VS Code" launch button,
      not deep theme/extension import (§20); component-shape-change hot
      reload messaging in `HotReloadSystem` (§13.3).
- [ ] Toolchain: move the CLI's real export/build to Rolldown (§16.3/§17,
      migrate this one before the IDE's in-browser path); GMS2 importer
      audit — confirm every documented 2.3+ import path is wired end-to-end,
      not stubbed anywhere in the chain (§9 — no scope change, just an
      audit).
- [ ] Repo-wide: adopt changesets (§20) before the module-package split
      (Track 2) creates more packages to version by hand.
- [ ] Docs: scaffold the TypeDoc + typedoc-plugin-markdown pipeline (§19.1)
      — can start against v1 code now and simply point at v2 code once it
      exists, rather than waiting.
- [ ] **Do not touch** `docs/reference/`, `docs/manual/`, `ai/CLAUDE.md`,
      `ai/api-reference.json`, or any `emptysock-ai-skills` skill file to
      describe v2 shapes yet — §9 is explicit that docs/skills are the last
      pass, after the API in Tracks 0–2 is real, or they'll describe a shape
      that doesn't exist.

---

## Starting a new pass

All prior work is on `main` in each repo. Create a new branch from `main` in each repo at the start of the next pass.

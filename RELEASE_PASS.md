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

The two v1 IDE bugs and Track 0 of the `ENGINE_DESIGN.md` implementation plan are
done and merged to this branch (`claude/adoring-dirac-4tiv8c`). Durable decisions
from that work are migrated into `CLAUDE.md`'s "Non-obvious decisions" section
(the rc-dock anchor-tab docking fix, the Monaco ambient-module-declaration fix).
Read in this order:

1. **`ENGINE_DESIGN.md`** (repo root) — the locked v2 engine spec. §22 is the
   readiness table; §23 is the most recent round. Track 0 (Entity/Component
   core wrapping bitECS, Game/Scene lifecycle, the Serializable constraint,
   the headless testing harness) is implemented at `packages/engine/src/v2/`
   and `packages/engine/src/testing/` — a new subpath export, **not** a
   replacement of the v1 code at the package root. v1 (`packages/engine/src/core/`
   etc.) keeps running unmodified; every other system still runs on it.
2. **This file's open items below** — Tracks 1, 2, and X of the
   `ENGINE_DESIGN.md` implementation, now that Track 0 is real. Track 1 items
   are independent of each other and can run as separate parallel sessions.
   Track 2 depends on Track 1 substantially landing (mainly rendering + the
   frozen core API), except `@emptysock/network` which only needs Track 0.
   Track X is fully independent of `packages/engine` and can run anytime.
3. **`CLAUDE.md`** — still accurate for the v1 engine and IDE (everything
   except the new `v2`/`testing` subpaths). Do not edit its "Non-obvious
   decisions" section to describe v2 engine shapes (Entity/Component/Scene/
   Game internals) until a system actually migrates onto `v2` — it should
   keep describing what's actually running under `import "@emptysock/engine"`
   until that changes. (Non-engine-shape decisions, like the two IDE fixes
   above, are fair game to add as they land, same as always.)

---

## Current pass — implementing `ENGINE_DESIGN.md`, Tracks 1/2/X

**Read `ENGINE_DESIGN.md` §9 and §22 before starting anything**, plus the v2
core itself at `packages/engine/src/v2/` — every Track 1/2 item below builds
on that API (`defineComponent`, `entity.get`/`.add`, `scene.spawn`/`.each`,
`Game.loadScene`/`.unloadScene`), not on v1's `core/Entity.ts`/`Scene.ts`.

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

- [ ] **Visual scripting.** Nodes compile to literal calls against the same
      public API Track 0/1 produced (§12.2) — needs that API stable first.
- [ ] **Module packages.** Split VN/Story Graph, battle system,
      tilemap/navmesh into their own `@emptysock/<module>` packages (§13.1).
      Each of these can itself be a further-parallel sub-track once rendering
      (VN, tilemap) and core (battle) have landed.
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
- [ ] **MCP live bridge.** Engine-side query/command channel (§8, extends
      `core/IDEBridge.ts`) — the engine side needs Track 0 (done) and
      benefits from Track 1's physics landing (for raycast/overlap queries);
      the `emptysock-mcp`-side relay implementation can be built against a
      mocked channel in parallel and wired up once the real one exists.

### Track X — fully independent of `packages/engine`, can run anytime, in parallel with everything above

- [ ] IDE: schema-driven Inspector property panels reading each component's
      optional co-located schema (§10.1); "open in VS Code" launch button,
      not deep theme/extension import (§20); component-shape-change hot
      reload messaging in `HotReloadSystem` (§13.3).
- [ ] Toolchain: move the CLI's real export/build to Rolldown (§16.3/§17,
      migrate this one before the IDE's in-browser path).
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
- [ ] Repo-wide: adopt changesets (§20) before the module-package split
      (Track 2) creates more packages to version by hand.
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
      **Reconciliation with the "don't touch docs/reference/ yet" rule
      below:** the pipeline is real and runs today, but `typedoc.json`'s
      `out` points at `docs/reference-generated/` (gitignored, nothing
      generated is committed), not `docs/reference/` — see
      `docs/reference-generated.README.md` for the full reasoning. **To go
      live** once the §9 docs pass actually starts: change `"out"` in
      `typedoc.json` from `"docs/reference-generated"` to
      `"docs/reference"`, remove the `docs/reference-generated/` line from
      `.gitignore`, regenerate, and commit — no other config changes
      needed.
- [ ] **Do not touch** `docs/reference/`, `docs/manual/`, `ai/CLAUDE.md`,
      `ai/api-reference.json`, or any `emptysock-ai-skills` skill file to
      describe v2 shapes yet — §9 is explicit that docs/skills are the last
      pass, after the API in Tracks 0–2 is real, or they'll describe a shape
      that doesn't exist.

---

## Starting a new pass

All prior work is on `main` in each repo. Create a new branch from `main` in each repo at the start of the next pass.

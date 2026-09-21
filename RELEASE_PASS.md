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

- [ ] **Physics.** `PhysicsBody` component, `PhysicsSystem`/`PhysicsSystem3D`
      wrapping Rapier2D/3D, `onCollide` as a plain property (§6), fixed
      timestep + interpolation (§10.3), the opt-in deterministic build swap
      via `@dimforge/rapier{2,3}d-deterministic-compat` (§15.2/§23 audit).
      Wire the real physics step + collision dispatch into `Game.update()`'s
      steps 3/4 (currently no-op placeholders, see `v2/Game.ts`).
- [ ] **Rendering.** `Sprite`/render components wrapping Pixi, `RenderPipeline`
      defaulting to the WebGL renderer (§18 audit finding), overlay scenes
      (`Game.loadOverlay`, §12.3). Wire the real render step into
      `Game.update()`'s step 7 (currently a no-op placeholder).
- [ ] **Input + Audio.** Action-mapping input layer with raw per-device
      escape hatch (§15.3); Howler-backed audio wrapper (confirmed still
      correct, §18). Wire the input snapshot into `Game.update()`'s step 1
      (currently a no-op placeholder).
- [ ] **Services + Save system.** Typed `game.services` registry (§5);
      `SaveSystem` with automatic per-runtime-target backend (IndexedDB/Tauri
      fs) and the per-component `migrate()` hook (§19.3) — build on the
      `Serializable` constraint already landed at `v2/Serializable.ts`.
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
      (done), does **not** need physics/rendering, so this can start now.
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

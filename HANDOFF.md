# Handoff

Branch `claude/admiring-bohr-xzzozo` in the engine repo, with a matching branch in the companion skills repo. Everything below is committed and pushed. Start a new session from here.

## Goal (cleared, still the direction)

Port a large real GameMaker game to this engine so it "just works": full asset conversion, room data editable in the IDE room editor, working cameras, lighting parity, sound (wav/ogg + compression), fonts, sequences, signals, typed globals, per-platform included files, no stubs, no honest gaps. `place_meeting` and friends are bbox checks, not GameMaker's Box2D physics. Also wanted: an on-screen windshield rain effect that looks like a polished racing-game weather effect, not a simple procedural filter.

## What is done (all committed)

- Importer and transpiler: assets, rooms (views, backgrounds, tiles, layer elements), objects, enums, macros, source-bug report, bitmap fonts, shaders, sounds (opt-in compression), notes as `.txt`, per-platform included files (web, desktop, android/ios/raspi staging).
- Runtime: `GmsProjectRuntime` (Create, Step x3, Collision, Draw, Alarm, Key, persistent instances, camera follow, multi-view compositing), surfaces and blend modes, layer elements, room walk test over all rooms of one large project (0 handler errors).
- Engine systems: `SignalBus`, typed `GlobalStore`, merged `InputManager` bindings, `TextureStore`, `RainGlassFilter` (needs a rewrite), rain particle preset, `BitmapFontDef`.
- IDE: room editor (drag/resize instances, entities, views; pan/zoom; port overlay), game globals panel with persistence.
- Housekeeping done: project names purged, decision record split into `docs/decisions/`, research reports in `docs/research/` (01-12).
- Sweeps done: rain rewrite, pixi leak fixes, asset index (importer `asset-index.json`, `game.assets`, `GmsProjectData.assetIndex`), keyboard layouts, unified scene shape (`SceneDocument`), entity refs, persistence (scene transfer, persistent rooms, save v2), gml parser (partial), `SpriteFlash` hit-flash (pooled `ColorOverlayFilter`; importer `sh_white` mapping skipped).
- Test status when last run: engine 910, toolchain 606 (+1 skipped), types 52. GPU playthrough and multi-project walk scripts are committed but never run.

## Next session tasks

Still open (details in `gpu_followup_real_browser.md`):

- WebGPU/naga shader converter (GLSL to WGSL for imported shaders).
- Prefab migration onto the unified scene shape.
- Real-GPU pass: rain, SpriteFlash pixels, flash cost benchmark, playthrough scripts.
- Rust/Tauri code is uncompiled; build it before trusting it.
- GML pipeline redesign (the parser is only partly done).
- Then the user's `AskUserQuestion` round and architecture-skills review, then the docs pass (docs, skills and mcp repos are being redone by the user; do not touch them).

## Orchestration method that worked

- Keep the main context small. Launch scoped background agents with explicit file ownership (one agent per set of files; serialise agents that touch the same files, for example `RenderPipeline.ts`).
- Each agent prompt: repo, branch, numbered items, "commit each item by explicit path, Conventional Commit lowercase subject, push after each", "reply tersely per item incl. what you could not do".
- Agents share one working tree and git index, so do not run two agents that both commit.
- Verify, do not trust reports: after each agent, read `git log`, `git status`, and spot-run the relevant tests; spot-read the diff for any claim of a root cause. An agent misdiagnosed two "source bugs" once and was caught only by tracing.
- Agents can hit the API rate limit mid-task: check the tree for uncommitted work, run the relevant tests, then commit or relaunch.
- Hooks: a Stop hook checks for uncommitted/untracked files; commit and push before ending a turn.

## User preferences to keep

- Terse output. No unnecessary questions; decide autonomously, batch real ambiguities into one `AskUserQuestion` round after the sweeps.
- Standard library first, libraries where they clearly beat hand-rolled code; never hand-roll something a maintained library does.
- No mention of reference projects anywhere in the engine (code, comments, tests, scripts, env var names, notes); keep the learnings only.
- `CLAUDE.md` stays tiny (it is reread every session).
- Do not touch docs, skills or mcp repos; the user is redoing them.
- Do not run or wait on game-verification tests unless asked; verify code.

## Repos and branches

- Engine: `eleferrets/emptysock-engine`, branch `claude/admiring-bohr-xzzozo`.
- Skills: `eleferrets/emptysock-ai-skills`, same branch (a commit there, `d3a04dd`, adds skills the user wants redone anyway; ask whether to revert).
- MCP repo: untouched.

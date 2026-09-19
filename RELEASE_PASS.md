# Release Pass

Cross-session task log. Before starting any work, write open items here with `[ ]`.
Mark `[x]` when done. Keep this file next to `CLAUDE.md` so it survives context compaction.

This is the canonical log — it does not live in companion repos.

---

## Status key

- [x] Done
- [ ] Open
- [~] Partial

---

## Pre-release quality pass — all complete

- [x] Behavior system wired (`addBehavior`/`removeBehavior`/`update`/`destroy` on `Entity`)
- [x] `BehaviorContext.scene` made optional (circular import fix)
- [x] `ParticleSystem` — `'line'` emitter shape implemented
- [x] `ImageWidget` — all four `scaleMode` values implemented
- [x] `SliderWidget` — `_resolvedX` set in `render()`; UISystem passes pointer x before click
- [x] `docs/reference/camera.md` — rewritten for real instanced `CameraSystem` API
- [x] `docs/guides/input-and-gamepad.md` — removed nonexistent `axis()`/`pointer.*`; real mouse API added
- [x] `docs/manual/12-tutorial-platformer.md` — Camera API and `CameraBounds` property names fixed
- [x] `ai/AGENTS.md` — Timer/Audio/Camera/SaveSystem class names corrected
- [x] `ai/CLAUDE.md` — Camera instanced pattern; SaveSystem synchronous; Common Mistakes table removed (enforced by lint/types instead)
- [x] `ai/api-reference.json` — CameraSystem, GamepadSystem, Widget.on, SaveSystem all corrected
- [x] `skills/00-quickstart.md` — Camera and Gamepad sections corrected
- [x] `skills/01-actor-model.md` — inbox cap caveat added
- [x] MCP particle tests — `maxParticles` → `emissionRate`/`lifetimeMin`/`lifetimeMax`
- [x] MCP `physics_raycast_3d` test — updated to assert tool not registered
- [x] `eslint.config.mjs` — `no-restricted-globals` for `setTimeout`/`setInterval`/`localStorage`/`sessionStorage`; `no-restricted-imports` for direct library imports
- [x] `eslint.config.mjs` — `no-misused-promises` (checksVoidReturn) + `require-await` catches `async onUpdate()` at lint time

---

## Open items

None.

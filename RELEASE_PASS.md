# Release Pass — Running Log

Active branch: `claude/nifty-fermat-wsmwml`
Session: https://claude.ai/code/session_01UY8VuKQkGwEmRFAMiP71kK

This file is the persistent task log for the pre-release quality pass.
Update it after every fix or compaction so context can be recovered.

---

## Status key

- [x] Fixed and pushed
- [ ] Open / not started
- [~] Partial / needs verification

---

## Pre-existing bugs fixed this session

### Engine — `packages/engine`

- [x] **Behavior system completely unwired** — `addBehavior` / `removeBehavior` / `update()` wiring did not exist on `Entity`. All 8 behavior classes were exported but unusable. Fixed in `core/Entity.ts` using a structural `BehaviorLike` interface to avoid circular imports. `onAttach` / `onDetach` called correctly; behaviors detached on `entity.destroy()`.
  - File: `packages/engine/src/core/Entity.ts`

- [x] **`BehaviorContext.scene` was non-optional** — caused a circular import requirement (`Entity → Scene`). Made `scene?: Scene` (optional) in `behaviors/Behavior.ts`.
  - File: `packages/engine/src/behaviors/Behavior.ts`

- [x] **ParticleSystem `'line'` EmitterShape silently fell through** — `EmitterShape` union included `'line'` but `_spawnOne()` had no branch for it, so line emitters spawned at a point. Added the horizontal-line spawn branch.
  - File: `packages/engine/src/systems/ParticleSystem.ts`

- [x] **ImageWidget `scaleMode` ignored** — only `'stretch'` was implemented; `'fit'`, `'fill'`, and `'none'` all did the same as stretch. Fixed with correct aspect-ratio math and canvas clipping.
  - File: `packages/engine/src/ui/widgets/image.ts`

- [x] **SliderWidget non-interactive** — `_resolvedX` was never set during `render()`, so `_applyPointerX()` always calculated from 0. Also `UISystem.handleClick()` never passed the pointer x to the widget before calling `triggerClick()`. Both fixed.
  - Files: `packages/engine/src/ui/widgets/slider.ts`, `packages/engine/src/systems/UISystem.ts`

### Docs — `docs/`

- [x] **`docs/reference/camera.md` described a nonexistent static `Camera` class** — completely rewritten for the real instanced `CameraSystem` API (`attach`, `setFollow`, `setLerpFactor`, `setBounds`, `shake`, `zoomTo`, `snapTo`, `moveTo`, `worldToScreen`, `screenToWorld`, `update`, `destroy`).
  - File: `docs/reference/camera.md`

- [x] **`docs/guides/input-and-gamepad.md` had nonexistent APIs** — `input.axis()` and `input.pointer.*` do not exist. Replaced with real API: `mouseX/mouseY/mouseDX/mouseDY`, `isMouseDown/isMousePressed/isMouseReleased`. Added missing `isButtonPressed/Released/Down` section for `GamepadSystem`.
  - File: `docs/guides/input-and-gamepad.md`

- [x] **`docs/manual/12-tutorial-platformer.md` used wrong Camera API** — `Camera.follow()` and `Camera.setBounds({ left, top, right, bottom })` don't exist. Fixed to instanced `this._camera.setFollow()` and `this._camera.setBounds({ minX, minY, maxX, maxY })`.
  - File: `docs/manual/12-tutorial-platformer.md`

### Tests — `emptysock-mcp`

- [x] **MCP particle tests used removed field `maxParticles`** — renamed to `emissionRate` in a prior session but tests were not updated.
  - File: `emptysock-mcp/src/tests/tools.test.ts`

- [x] **MCP `physics_raycast_3d` test assumed the tool existed** — tool was removed but test expected it to work. Updated to assert it throws/is not registered.
  - File: `emptysock-mcp/src/tests/tools.test.ts`

---

## Pre-existing doc / skill inaccuracies fixed this session

All in `emptysock-ai-skills` repo:

- [x] **`ai/AGENTS.md` — `Timer` class does not exist** — Rule 4 and the Timers snippet used `Timer.after()`, `Timer.every()`, `h.cancel()`. Corrected to `tweens.after()` / `tweens.every()` on a `TweenManager` instance; `tweens.destroy()` for cleanup (no per-timer cancel handle). Rule 6 updated accordingly.

- [x] **`ai/AGENTS.md` — wrong class names for Audio and Camera** — `Audio.play()` → `AudioSystem.play()`; `Camera.follow()` → instanced `CameraSystem` with `attach` / `setFollow` / `shake` / `zoomTo`.

- [x] **`ai/AGENTS.md` — `waitForEvent` not exported** — removed from coroutine example.

- [x] **`ai/AGENTS.md` — `SaveSystem` shown as static async** — `SaveSystem` is instanced and synchronous. `save()` returns `boolean`; `load()` returns `SaveSlot | null`. Fixed.

- [x] **`ai/CLAUDE.md` — Camera section showed static `CameraSystem.*` methods** — rewritten as full instanced pattern with `onLoad` / `onUpdate` / `onDestroy` lifecycle.

- [x] **`ai/CLAUDE.md` — `CameraSystem.shake()` in coroutine example** — changed to `this._camera.shake(12, 0.5)` (correct instance call, correct signature).

- [x] **`ai/CLAUDE.md` — SaveSystem shown as async** — `async function save()`, `await SaveSystem.save()` → synchronous instanced pattern.

- [x] **`ai/api-reference.json` — CameraSystem documented entirely wrong static API** — rewritten with all 15 real instance methods and correct signatures.

- [x] **`ai/api-reference.json` — GamepadSystem missing `isButtonPressed/Released/Down`** — added.

- [x] **`ai/api-reference.json` — `Widget.on()` return type was `void`** — corrected to `() => void` (returns unsubscriber).

- [x] **`ai/api-reference.json` — SaveSystem documented as static async** — rewritten as instanced synchronous API.

- [x] **`skills/00-quickstart.md` — wrong static Camera API** — replaced with correct instanced pattern.

- [x] **`skills/00-quickstart.md` — missing Gamepad section** — added `isButtonPressed/Released/Down`, `rumble`, `rumbleDual`.

- [x] **`skills/01-actor-model.md` — missing inbox cap caveat** — added inbox cap (1000 messages, drops with `console.warn`) and flush-pass same-frame re-send behaviour.

---

## Remaining open items

None identified at this time. If Gemini's review surfaces new issues, log them here with `[ ]` and fix them.

---

## Commit history (this branch)

| Commit    | Scope     | Summary                                                                  |
| --------- | --------- | ------------------------------------------------------------------------ |
| `661c2f0` | engine    | fix behavior system wiring + particle line shape                         |
| `06310bf` | engine    | docs: correct camerasystem, input, savedsystem api references            |
| `a43a893` | engine    | chore: add vitest, jsdom, husky, lint-staged, commitlint                 |
| `2e405b1` | ai-skills | (prior session — skills 00-quickstart and 01-actor-model)                |
| `c83a5e5` | ai-skills | fix: correct camerasystem, savedsystem, timer api across all agent files |
| (mcp)     | mcp       | fix particle and physics_raycast_3d tests                                |

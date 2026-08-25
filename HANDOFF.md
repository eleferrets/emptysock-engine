# EmptySock — Skills Repo Handoff

## Context

The agent pack lives at **`github.com/eleferrets/emptysock-ai-skills`**.

The `ai/` folder and `skills/00-quickstart.md` are written and solid. The remaining
20 skill files listed in the README are empty slots that need to be filled.

---

## Task: Fill All Missing Skill Files

The README declares 21 skill files. Only `skills/00-quickstart.md` exists.
Write the remaining 20 files listed below, then also fill the 4 missing `docs/` files.

Use the PRD at `github.com/eleferrets/emptysock-engine` as the source of truth for
all API shapes, system names, method signatures, and behaviour. Cross-reference
`ai/api-reference.json` and `ai/CLAUDE.md` for exact method names.

---

## Missing Skill Files (`skills/`)

| File | Content to write |
|---|---|
| `01-project-setup.md` | `emptysock.project.json` manifest schema, folder structure (`src/`, `assets/`, `meta/`, `export/`), icon pipeline (one 1024px PNG → all sizes auto-generated), splash config |
| `02-scenes.md` | `SceneManager.load()`, `SceneManager.transition()`, scene lifecycle hooks (`onEnter`, `onExit`, `onUpdate`, `onFixedUpdate`), scene queuing |
| `03-entities.md` | `scene.createEntity()`, `entity.addComponent()` / `getComponent()` / `removeComponent()`, tags, `entity.destroy()`, prefabs, `ObjectPool` |
| `04-rendering.md` | `Sprite` component, `Animator`, texture atlas, normal maps, `PixiJS` renderer waterfall, `autoDetectRenderer` config, `powerPreference: 'high-performance'` |
| `05-physics.md` | `PhysicsBody` shapes/types, `CharacterController`, `RigidJoint`, sensors (`onSensorEnter/Exit`), collision callbacks, CCD, raw Rapier escape hatch |
| `06-input.md` | `Input.isDown()`, `Input.isPressed()`, `Input.isReleased()`, `Input.pointer`, touch, `Input.onKeyDown()`, gamepad axes/buttons, dead zones |
| `07-audio.md` | `Audio.play()`, `Audio.music()`, `Audio.setGroupVolume()`, spatial audio, audio sprites, mobile unlock, `AudioSystem` group API |
| `08-tilemaps.md` | `TilemapSystem.load()`, layer types (tile/collision/object), `map.getLayer().enablePhysics()`, spawn-point entities, `.esmap` format |
| `09-particles.md` | `scene.createParticleEmitter()`, all emitter props, `emitter.emit(n)`, GPU tier particle limits, `.esparticle` format |
| `10-ui.md` | `scene.createUI()`, built-in components (Button/Panel/Text/Slider/Toggle/ProgressBar), anchors, safe zones, `button.onClick()` |
| `11-visual-novel.md` | `VNController` component, `.esvn` format, node types (dialogue/choice/event/jump/condition), `vn.advance()`, `onChoice`/`onEvent` callbacks, localisation key integration |
| `12-pathfinding.md` | `PathfindingSystem.findPath()`, `GridCell`, `PathFollower` component, navmesh API, debug overlay, WASM acceleration note |
| `13-save-system.md` | `SaveSystem.save()` / `load()` / `listSlots()` / `delete()`, auto-save config, cloud save setup, Zod validation at load, `localStorage` vs Tauri filesystem |
| `14-localisation.md` | `LocalisationSystem.setLocale()`, `t(key, vars)`, plural rules, RTL layout, per-locale font loading, VN integration, translation file format |
| `15-post-processing.md` | `SceneManager.transition()` effects (fade/wipe/iris/slide/zoom/dissolve/flash/custom), `scene.postProcess.add()`, all 10 effects, `Camera.flash()` / `Camera.fade()` |
| `16-coroutines.md` | `entity.startCoroutine(function* …)`, all yield helpers (`waitFrames`, `waitSeconds`, `waitUntil`, `waitForEvent`, `waitForAnimation`, `waitForPath`, `waitForDialogue`), `entity.stopCoroutine()` |
| `17-tweens-timers.md` | `Tween.to()`, easing functions, `Timer.after()`, `Timer.every()`, cancel patterns, why NOT to use `setTimeout` |
| `18-3d.md` | Scene `type: '3d'` / `'hybrid'`, `Mesh` component, `Light` component, `Camera3D`, `zOrder: 'above'/'below'`, glTF loading, baked lightmaps |
| `19-export.md` | All 7 platform targets, `emptysock.project.json` export config, icon pipeline, esbuild security settings (no source maps, drop console, mangle), CI verification checks |
| `20-performance.md` | GPU tier table (potato→ultra), draw call budget (warn at 50 on Pi 4), sprite batching, particle limits per tier, Mali-G72 compat layer, Raspberry Pi performance targets |
| `21-typescript.md` | Banned patterns (`any`, `!`, `@ts-ignore`, `setTimeout` in game loops, direct PixiJS imports), required patterns (Zod at boundaries, `import type`, explicit return types), ESLint rules |

---

## Missing Docs Files (`docs/`)

| File | Content |
|---|---|
| `docs/templates.md` | What each template contains and teaches (blank, platformer, top-down shooter, puzzle, visual novel, tech demo), how to use them as a starting point |
| `docs/troubleshooting.md` | Common errors: WASM init failure, WebGL context lost, Mali artefacts, missing asset 404s, save slot corruption, export size too large |
| `docs/migration.md` | v1.0→v1.1 changes, how to update project manifest, any renamed APIs |
| `docs/faq.md` | Why no source maps? Why Rapier2D not Box2D? Why Howler not WebAudio directly? How to add a custom shader? Can I use React in-game? |

---

## Writing Guidelines

- Every file starts with a `# Title` and a one-line description.
- All code blocks use `typescript` syntax highlighting.
- Use exact method names from `ai/api-reference.json` — do not invent API surface.
- Show complete, runnable snippets (not fragments). Each example should work if
  pasted into a scene's `onEnter()`.
- Note GPU tier behaviour where relevant (e.g. shadows disabled on `potato`).
- Note platform differences (Raspberry Pi, mobile) where the PRD calls them out.
- Keep each file focused and scannable — the agent reads it at task start, not as a tutorial.

---

## How to verify

After writing all files, run:
```bash
ls skills/ | wc -l   # should be 21
ls docs/ | wc -l     # should be 6
```

Commit with `docs: fill all 20 skill files and 4 missing docs` and push to `main`.

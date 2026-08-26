# EmptySock Engine — Session Handoff

Branch: `claude/main-ui-passthrough-review-9doi3y` → merged to `main`

---

## Non-obvious decisions

### Architecture

**Why `@emptysock/engine` re-exports everything through one barrel**
Internal deps (PixiJS v8, Rapier2D WASM, Howler.js) are deliberately hidden behind the engine package. Game code must never `import { Container } from 'pixi.js'` directly. The `GameStage` type alias in `packages/engine/src/types/aliases.ts` is the one sanctioned way to type a stage reference. If new PixiJS types need to surface publicly, add aliases there — don't add pixi.js to the public API.

**Why esbuild `transform()` in the play runner, not `build()`**
`transform()` is single-file, in-process, and has no FS access — safe to run inside a web worker without a real project on disk. The full `build()` call (used in exports) needs a real project dir. `buildForPreview` in `export-utils` uses `transform`; all platform exports use `build`.

**`GameBuildService` is a stub**
`apps/ide/src/services/GameBuildService.ts` does lightweight in-process string validation — it does NOT call esbuild. In the real desktop app (Tauri), the build button would call a Tauri command that runs `buildForPreview` from `@emptysock/export-utils` on the native side. The service interface (`BuildJob`, `onComplete`) is already shaped correctly for that wiring.

**`CanvasPreview` runs a hardcoded bouncing balls demo**
The play runner canvas in `apps/ide/src/components/panels/CanvasPreview.tsx` renders `BouncingBallsDemo` — a self-contained PixiJS scene used as a placeholder. It is not connected to the code editor. Real wiring: when the user hits Run, compile the editor code via `buildForPreview`, inject the resulting IIFE into a sandboxed `<iframe>` or worker, and stream its `console` / FPS output back via `postMessage`. The store already has `playState`, `fps`, `debugOverlay` fields ready for this.

**Why `archiver` instead of the system `zip`/`tar`**
User requirement: no system binaries. `archiver` (npm) bundles zip and tar support. The `ZipArchive` class is used directly (not the default export) because the `@types/archiver` v8 package exports named classes, not a callable default.

**Raspi = Linux ARM, not a separate pipeline**
`exportRaspi` in `export-utils` is the Linux export with `arch: 'arm'` semantics and a `game-raspi-arm.zip` output name. It shares the same esbuild bundle — there is no cross-compilation. The game runs inside Chromium kiosk mode or Electron-arm on the Pi; the JS is identical to the Linux x86 build.

**Why `statSync` in `shellGradle` could throw**
`shellGradle` checks for a `gradlew` file with `statSync` and will throw if `android/` doesn't exist. This is intentional: if the `android/` project dir is missing, the error message from the crash is clear enough. A future improvement is an explicit `existsSync` check with a friendlier message.

**`exactOptionalPropertyTypes: true` in tsconfig**
This is set project-wide. Any optional prop typed `T | undefined` fails strict checks when assigned directly. Pattern: use conditional spread `...(condition ? { prop: value } : {})` instead of `prop: condition ? value : undefined`. See the `drop`/`mangleProps` fix in `export-utils/src/index.ts` for the pattern.

**GPU lighting shader coordinate assumption**
`LightingSystem`'s GLSL fragment shader normalises point light positions against a hardcoded 1280×720 resolution. If the canvas is a different size the light positions will be off. Fix: pass `uResolution` as a uniform and normalise against it instead. Filed as a known limitation.

**Mali compat is detect-only**
`detectMali` / `applyMaliFixes` exist and are exported but `applyMaliFixes` currently sets flags on the renderer options object — it does not patch the GLSL shaders. The real fix for Mali-G72 precision bugs (the main target) requires `precision mediump float` headers in the LightingSystem shaders. This is noted but not implemented.

---

## What the PRDs wanted that isn't built yet

The existing `HANDOFF.md` (now replaced by this file) described an **ai-skills repo** (`eleferrets/emptysock-ai-skills`) that needs 20 skill files and 4 docs files written. That is a separate repository task, not work in this engine repo. A follow-up session on that repo should use the skill table in git history (the previous HANDOFF.md content) as its task list.

Within **this engine repo**, the following PRD items are not yet implemented:

### IDE — wiring gaps
- **Play runner not connected to editor**: `CanvasPreview` shows a hardcoded demo; the real pipeline (compile editor code → inject into sandboxed iframe → stream FPS/console back) is not wired
- **Export panel UI**: the export targets UI in the IDE is not implemented; `GameBuildService` doesn't call the actual export functions from `@emptysock/export-utils`
- **File save / open from disk**: the editor stores code in Zustand state only; there is no Tauri FS integration yet
- **Quick open / command palette**: `Ctrl+P` / `Ctrl+Shift+P` shortcuts are documented in the manual but not implemented in the Monaco editor panel
- **Clear cache command**: documented in the manual; not wired to an actual action in the store

### Engine — missing systems from PRDs
- **TilemapSystem**: referenced in the ai-skills PRD skill list; not implemented
- **ParticleSystem**: same — not implemented
- **3D/hybrid scene mode**: `type: '3d'` / `type: 'hybrid'` mentioned in the PRD; not implemented
- **`SceneManager`**: the engine has `Scene` (single-scene) but no multi-scene manager with transitions, `onEnter`/`onExit` hooks, or scene queuing
- **Tween system**: `Tween.to()` / `Timer.after()` / `Timer.every()` referenced in skills but not in the engine package
- **`ObjectPool`**: referenced in prefabs/skills; not implemented
- **Sensor callbacks**: `onSensorEnter` / `onSensorExit` on `PhysicsBody`; Rapier supports sensors but the ECS bridge doesn't expose callbacks yet
- **UI system**: `scene.createUI()` / Button / Panel / Text components referenced in skills; not implemented
- **Post-processing effects**: `scene.postProcess.add()` + transition effects (fade, wipe, iris, etc.); not implemented
- **`RigidJoint`**: physics joints not in `PhysicsBody` or a separate component yet
- **Normal map diffuse lighting**: `LightingSystem` accepts `useNormalMap` flag but the GLSL doesn't sample the normal map texture yet

### Export
- **Installable export targets**: the user asked for HTML5 as the default-installed target with other platforms downloaded on demand. The current implementation has all targets always available; there is no plugin/download system yet.
- **Windows installer**: NSIS path is typed but the bundled NSIS binary is not shipped — `shellNsis` still falls back to system `makensis`. Need to bundle an NSIS binary or use a pure-JS NSIS alternative.

### Toolchain
- **`VMRunner`**: `packages/toolchain/src/VMRunner.ts` exports `runInVM` / `pullImage` / `runLinuxTests` but these shell out to Docker. The user asked for a "bundled vm runner" for play testing. The current implementation is a Docker wrapper for cross-platform CI testing, not an in-IDE sandboxed runner.

---

## Current test count
- `@emptysock/engine`: 101 tests across 19 files
- `@emptysock/export-utils`: 26 tests
- `@emptysock/toolchain`: present, vitest config added
- `@emptysock/ide`: present
- All pass, zero type errors as of last push

## Branch state
All work is on `claude/main-ui-passthrough-review-9doi3y`, merged to `main`.

# Improvements

## IDE Toolbar Logo

The logo next to the "EmptySock" text in the toolbar currently always renders the dark-background version of `assets/logo.svg`. When the IDE supports a light theme, the logo should switch variants:

- **Dark mode** → dark background logo (current, `#0f0f1a`–`#1a1a3e` circle fill)
- **Light mode** → light background logo (`#ece9ff`–`#dcd7ff` circle fill)

The SVG in `assets/logo.svg` already handles this via `@media (prefers-color-scheme)` when embedded inline or as an `<img>` in a browser context. However, the IDE's own theme toggle (if added) would need to stamp `data-theme` on the root and the SVG media query won't respond to that — it only responds to the OS preference.

**Fix when the time comes:** either serve two separate SVG files (`logo-dark.svg`, `logo-light.svg`) and swap them in the Toolbar based on the active theme token, or inline the SVG into the Toolbar component and drive the fill colors from CSS variables that the theme system already controls.

---

## Build & Export Targets

There is only one build type: **release**. There is no debug build. The debugger is a live run tool, not a build phase (see Debugger section).

### Windows
- Architecture dropdown: **x64**, **x86**
- Output format dropdown: **MSI**, **EXE**, **ZIP**
- Most of the pipeline is shared across formats; the format selector is a thin layer on top.

### Linux
- Architecture: **x86**, **x64**, **ARM** (ARM is the implicit Raspberry Pi target — no separate Pi option; ARM should just work on Pi)
- Output format: developer chooses from **Flatpak**, **AppImage**, **tar.gz** — these are independent choices, not a fallback chain. Multiple can be selected per export.
- AppImage ARM support: verify at implementation time — if ARM AppImage is supported by the time this is built, include it; if not, omit it from the ARM format options and note why.
- tar.gz is the minimum that must always be available on all Linux architectures.

### macOS
- Universal binary (ARM + x64 in one app) is the target
- **We should not be building for Mac ourselves** — the correct path is sending the project through Xcode and letting Apple's toolchain handle signing, notarization, and the universal build. The IDE should hand off to Xcode, not produce a `.app` directly.
- A ZIP of the `.app` bundle is acceptable as a distribution format for informal sharing, but the real output is an Xcode project export.
- Users should be able to **run the game on Mac without a build step** — development run should be instant.

### Android & iOS
- Listed as future targets; no architecture or format detail yet.

### VS Code Integration Setting
- A user setting to open the project in the actual VS Code application (not the embedded editor), so the user's own extensions, themes, and keybindings apply.
- This is purely a convenience handoff — open the project folder in VS Code; no deeper integration needed.

---

## Debugger

The debugger is an **alternative live run tool** — a second play mode alongside the normal run, not a build phase and not a separate build type. There is only one build: release.

- "Debug" in the toolbar launches the game in the debug play runner with the debug overlay active.
- The debug overlay (variable inspector, entity state, hot reload controls, etc.) is only present during a debug run, never during a normal run or a release build.
- The **restart button** lives in the debug run phase UI alongside the overlay. It restarts the live run.
- Hot reload is a debug run feature — see Hot Reload section.
- For handing off source to another dev: archive/ZIP the project folder. That is the dev-to-dev transfer unit.

### Runtime Error Handling

Handlers are **user-defined code** — the developer writes them. They are not a platform toggle that automatically logs things. Without a handler in place, an unhandled runtime error behaves the same in both debug and live run: it stops the game and surfaces the error visibly.

**Without any handler (debug run or normal live run):**
- A **centered modal popup** appears in the runner window showing the error message and the file that produced it.
- The full stack trace is written to the runner output panel.
- The game stops.

**With a user-defined handler:**
- The handler intercepts the error before it becomes a crash. What happens next is up to the developer — writing to a log file, continuing past the error, silently skipping the failing system, etc.
- The engine provides the mechanism (a global hook and per-file/per-class registration); the developer provides the logic.
- Handler granularity:
  - **Global handler** — a single catch-all registered once; catches anything not already handled at a lower level.
  - **Per-file / per-class handler** — registered for a specific system (e.g. an audio subsystem that can fail gracefully without taking the whole game down).

The engine does not write to a log file by default. If a developer wants a log file, they write that in their handler. The platform just guarantees the error is delivered to the handler rather than crashing.

Source maps are **not** included in tester builds. Tester builds are release builds without source maps — they test the finished artifact. Source maps stay on the developer's machine.

### Collaboration / Tester Distribution (recommendation)
The right model here is two distinct flows:
1. **Dev handoff** — archive the project source (ZIP/tar the project folder). The receiving dev opens it in the IDE.
2. **Tester handoff** — produce a release build (no source maps) and distribute the built artifact (platform-appropriate: EXE, AppImage, etc.). Testers never touch source.

A lightweight "send to tester" action in the Export panel that builds release + packages it for the target platform covers the second case. There is no in-between "debug build for testers" — that concept is removed.

---

## Language Support

- **JavaScript files should be allowed as first-class game source files**, not just TypeScript. Developers should be able to write `.js` files in the IDE and have them work without requiring a `.ts` equivalent.

---

## Project Structure

- When creating a new project, the IDE should create a dedicated folder for it.
- All assets and resources created or imported within the IDE for that project should live inside that project folder — not in a global assets directory.
- This keeps projects self-contained and portable (zip the folder, hand it to a dev, done).

---

## Sprite Sheet Import

- Implement GMS2-style strip import: a sprite sheet file named or tagged with `_strip<N>` (where N is the frame count) should be automatically sliced into N equal-width frames on import.
- Example: `player_walk_strip8.png` → 8 frames extracted horizontally.
- This should be an import option in the Assets panel, not only a naming convention — the user should also be able to manually specify frame count if the filename doesn't carry it.

---

## Hot Reload (Debug Mode)

- During a debug run, support hot reload for:
  - **Variables** — update live values without restarting the run (highest priority)
  - **Assets / images** — swap a texture on disk and see it update in the running game
  - Code hot reload is harder and lower priority; variable and asset reload alone would cover most iteration loops
- This is distinct from a full restart. Hot reload should preserve game state where possible.

---

## Performance

- Investigate and reduce run startup time (time from pressing Play to game loop beginning).
- Investigate and reduce release build time.
- Candidates: parallelise the build pipeline, cache unchanged bundles, reduce the esbuild-wasm overhead on first initialisation.

---

## Aggressive Release Build Mode

- Add an opt-in setting in release build configuration: **Aggressive Optimisation**.
- When enabled, apply the full suite without mercy:
  - Dead code elimination / tree shaking (remove every unreachable export and import)
  - Minification (identifiers, whitespace, literals)
  - Inlining of small functions
  - Constant folding
  - Bundle splitting only where it helps load time; otherwise inline everything
  - Strip all debug metadata, comments, and console calls
- This is explicitly a "squeeze every last byte and cycle" mode. It may increase build time in exchange for the smallest, fastest output.
- Should be clearly labelled — not the default — so developers don't accidentally ship a slower debug-friendly build.

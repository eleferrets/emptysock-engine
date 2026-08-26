# Improvements

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

**With a handler:**
- The engine provides ready-made functions — the developer just calls one and passes the error object. No boilerplate, no file I/O to write themselves.
- `Engine.logErrorToFile(err)` writes the error to a log file. The second argument is an optional filename to write to. Defaults vary by handler scope (see below). Name TBD at implementation — something in the `log` / `handler` space, clearly indicating it writes to a file.
- The error object is whatever the engine hands the handler — message, file, line, stack, and anything else useful. The developer passes it straight through; they don't construct it.

**Two distinct mechanisms:**

**1. Global handler — a recognized file**

The engine looks for a reserved file in the project root (e.g. `errorHandler.ts` / `errorHandler.js`). If it exists, the engine treats it as the catch-all for any error not handled at the file/class level. The developer doesn't register it — the engine picks it up automatically by filename convention.

```ts
// errorHandler.ts — engine finds and runs this automatically
export default function(err) {
  Engine.logErrorToFile(err);             // → globalError.log
  Engine.logError(err, 'myGame');   // → myGame.log
}
```

**2. Per-file/per-class handler — a function call**

Inside any file or class, call `Engine.onError` to register a handler scoped to that file or class. Errors that originate there hit this handler first; anything unhandled falls through to the global file.

```ts
// AudioSystem.ts
Engine.onError((err) => Engine.logErrorToFile(err));          // → AudioSystem.log
Engine.onError((err) => Engine.logError(err, 'audio')); // → audio.log

class AudioSystem {
  onError(err) { Engine.logErrorToFile(err); }  // class-level, same idea
}
```

- Per-file/class handlers run first; unhandled errors fall through to `errorHandler.ts`.
- If `errorHandler.ts` doesn't exist, unhandled errors show the centered modal popup as normal.
- Default log name: source filename for per-file/class; `globalError` when called from `errorHandler.ts`.
- The filename argument to `Engine.logErrorToFile` is a base name — the engine appends the extension and writes to the platform's standard log location.

**`Engine.logDebugError(message)`**

A separate utility for writing a debug message to the runner output window. Unlike the error handler path, this is not tied to a thrown error — the developer calls it explicitly anywhere in their code. It writes to the output window in both normal run mode and debug run mode, so it works as a lightweight "always-visible" diagnostic regardless of which runner is active. Not a replacement for the error handler; just a convenient way to surface intentional debug output without stopping the game.

```ts
Engine.logDebugError('AudioSystem: buffer underrun at frame 142');
```

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

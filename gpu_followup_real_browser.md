# GPU / real-browser follow-up and open items

This file holds everything that is unverified on a real GPU or browser, everything still open, and the research pass to do next. The former CLAUDE.md decision record now lives in topic files; see `docs/decisions/README.md`.

## Needs a real GPU or real browser (only software WebGL was available)

- `RainGlassFilter` (rewritten as a CPU sim, drop-map texture and one GL pass): NOT verified on any GPU. Top risk: pixi v8 texture-resource binding for the GL-only filter (`resources: { uniforms, uDropMap: BufferImageSource, uDropMapSampler: source.style }`) may leave the drop map unbound or read as zero; the map format is set to `rgba8unorm` explicitly because pixi defaults a `Uint8Array` source to `bgra8unorm`. Also unchecked: vertical orientation of the map against `vUV`, `source.update()` re-uploading without re-creating the texture, the `textureLod` fog loop compiling on real drivers, and every cost figure (all tier timings are estimates; the old +2-3 ms swiftshader number is for the previous shader). Needs pixel asserts (flat map returns the scene, drop region displaced, fog blur monotonic), screenshots per tier, and frame timing on integrated, discrete and mobile GPUs. The gpu-verify harness was not updated for the new filter.
- Per-entity and per-layer importer shaders: pixel-checked in swiftshader only.
- Bitmap font atlas text (`BitmapText`): pixel-checked in swiftshader only.
- `UISystem` bitmap-font text (`IUIRenderer.drawImageRegion` glyph blits for Label/Button/Checkbox): unit-tested against a spy renderer only; never seen on a real Canvas2D surface (atlas edge bleed, baseline centring, blur on scaled canvases). Not built: dynamic `BitmapFont.install` for TTF in `RenderPipeline` (needs a real browser for FontFace load ordering and atlas output).
- Surface / `bm_subtract` cutout lighting: swiftshader only; advanced blend modes need a real GPU pass.
- Nine-slice and tiling sprites, room editor canvas (pan/zoom, view/entity/port dragging, resize handles): unit-tested only, never seen in a real browser.
- Multi-camera compositing (N render textures + composite): never profiled.
- Anything in `docs/gpu-verify/` and `packages/engine/scripts/gpu-*.mjs` (last commits: run with a generic fixture-dir env var; the harness and multi-project walk test were committed but never run).

## Open (not built)

- Room editor: drawing a brand-new view on the canvas; numeric window-size setting.
- Room-layer sequence elements: synthetic tests only (no real sample); play only after the game registers the sequence.
- Room-level persistent flag (whole-room state) unimplemented; persistence carry-over is bespoke in `GmsRuntime`, not a core engine feature.
- Declared game globals persist only as declarations, not runtime values.
- `event_inherited()`, `gml_pragma`: unresolved identifiers.
- `instance_change` does not re-point behaviour modules.
- Real-device GPU profiling of all N-pass techniques.
- Multi-project walk (`gms2-multi-project-walk.test.ts`) and GPU playthrough scripts: committed, never run.
- Source-bug report wording overclaims: "read but not provably assigned" is not "bug" (variables may be set through cross-file paths the text scan cannot see).

## Research pass to do next (before the docs pass)

1. Real GML parse plus symbol table (local / parameter / instance / global / asset / enum / macro / built-in) replacing name lists and regex guards; evaluate `@bscotch/gml-parser` vs a small Lezer grammar. Subsumes cross-file entity-ref scan, shadowing, cross-kind asset name collisions.
2. Keyboard layouts: `navigator.keyboard.getLayoutMap()` (Chromium only) plus `event.key` fallback, host-injected label provider (engine has no DOM); letters in `keyboard_check(ord(..))` should match by produced character; add a "capture next input" rebind helper.
3. Pixi audit with https://github.com/pixijs/pixijs-skills, ecosystem page, pixijs-userland: candidates `@pixi/layout` (WidgetTree yoga adapter), `@pixi/ui` (UISystem widgets), `pixi-viewport` (room editor camera), `@pixi/tilemap`, `@pixi/particle-emitter`, dynamic `BitmapFont`, room editor Canvas2D vs pixi. Mixing-three guide for optional real 3D behind the `d3d_*` compat. Expect mostly removals.
4. Shader: `Mesh` + `Shader` for sprite-level `shader_set` (avoids an offscreen pass per sprite) vs per-object `Filter`.
5. Rain glass: real-GPU verification of the rewrite (see above).
6. Cross-entity relationships: serialisable `EntityRef` fields with save/load remap, public relation API, queries, SignalBus.
7. Persistence: generalise carry-over into core scene transitions; room-level persistent flag.
8. Typed `AssetRegistry`: importer-generated manifest (kind, id, dimensions, frame count) plus engine registry; closes `sprite_get_width`, `sprite_exists`, `font_get_size` honest-zero gaps.
9. Fonts: `Label` widgets should use the registered `BitmapFontDef`; dynamic bitmap fonts for TTF.
10. `gmlNum` comparison fix: confirm string pass-through fixed the always-false sprite-name comparison with a test.
11. Purge every reference to the reference projects used during development from code, comments, tests, scripts, env var names and notes; keep only the learnings. Use a generic fixture-dir env var.
12. Stop touching docs, skills and mcp repos; they will be redone. Ask whether to revert the skills-repo commit `d3a04dd` and the engine doc edits from this session.


## Unverified (keyboard layout pass)

- Rust is NOT installed in the authoring environment: `apps/ide/src-tauri/src/keyboard_layout.rs`, the `lib.rs` registration and the new Cargo target dependencies (`core-foundation-sys` on macOS, `xkbcommon` 0.7 on Linux) are UNCOMPILED, and `Cargo.lock` was not regenerated. Run `cargo check` and `cargo test` in `apps/ide/src-tauri` on macOS and Linux (Linux needs libxkbcommon dev headers). Risks: exact `xkbcommon` 0.7 API signatures, the Carbon FFI declarations, and that TIS calls really run on the main thread for a sync Tauri command.
- Real-run checks not possible headless: macOS WKWebView and Linux WebKitGTK native query on AZERTY/QWERTZ/Dvorak/Cyrillic; Windows WebView2 `getLayoutMap` and whether the Tauri origin is a secure context; layout switch mid-session (refresh only on focus/visibility); Wayland (layout is read from GNOME gsettings or `setxkbmap`, which cannot see a compositor-only active group).
- The exported-game Tauri shell (`game-shell-template`) does not have the native command; only the IDE play iframe is wired. Exported games on macOS/Linux rely on keydown learning.
- `ENGINE_BUNDLE` in the IDE must be rebuilt to pick up `input.layout` for the play iframe.

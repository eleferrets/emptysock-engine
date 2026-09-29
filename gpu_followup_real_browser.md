# GPU / real-browser follow-up and open items

This file holds everything that is unverified on a real GPU or browser, everything still open, and the research pass to do next. The former CLAUDE.md decision record now lives in topic files; see `docs/decisions/README.md`.

## Needs a real GPU or real browser (only software WebGL was available)

- `RainGlassFilter` (CPU sim, drop-map texture, one GL pass): verified once on a real Mac GPU in Chromium (WebGL 2, harness `gpu-verify.harness.ts`). That run found and fixed a shader that failed to compile (no `#version 300 es`, so pixi prepended a GLSL ES 1.00 header and `textureLod` did not exist). After the fix the drop map binds and displaces the scene, fog and trails work (vertical/horizontal run ratio 0.98 at streak 0, 2.2 at streak 1; changed 7.6%, opaque 99.7%), and it costs about 0.9 ms over a passthrough filter at 640x360 (readback-synced, rough). Still open: per-tier screenshots and timing on integrated, discrete and mobile GPUs, map orientation was only eyeballed, and the WebGPU renderer (see the WebGPU note: GL-only filters do nothing there).
- Per-entity and per-layer importer shaders: pixel-checked in swiftshader only.
- Bitmap font atlas text (`BitmapText`): pixel-checked in swiftshader only.
- `UISystem` bitmap-font text (`IUIRenderer.drawImageRegion` glyph blits for Label/Button/Checkbox): unit-tested against a spy renderer only; never seen on a real Canvas2D surface (atlas edge bleed, baseline centring, blur on scaled canvases). Not built: dynamic `BitmapFont.install` for TTF in `RenderPipeline` (needs a real browser for FontFace load ordering and atlas output).
- Surface / `bm_subtract` cutout lighting: swiftshader only; advanced blend modes need a real GPU pass.
- Nine-slice and tiling sprites, room editor canvas (pan/zoom, view/entity/port dragging, resize handles): unit-tested only, never seen in a real browser.
- Multi-camera compositing (N render textures + composite): never profiled.
- Anything in `docs/gpu-verify/` and `packages/engine/scripts/gpu-*.mjs` (last commits: run with a generic fixture-dir env var; the harness and multi-project walk test were committed but never run).

- WebGPU renderer (measured on a real Mac browser): `RenderSystem` prefers `["webgpu", "webgl"]`, and under WebGPU the GL-only `RainGlassFilter` silently renders nothing (no error, frame unchanged; `rendererFilterProbe` in `gpu-verify.harness.ts`). Every `CustomShaderFilter` (imported GML shaders) is GL-only too, so they are assumed to do the same. Fix landed but UNVERIFIED on a GPU: GLSL-to-WGSL conversion (`docs/research/11-glsl-to-wgsl.md`; see the WGSL section below); fallback is `preference: ["webgl"]`.

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

## SpriteFlash pixel check (needs a real GPU)

`SpriteFlash` attaches a pooled pixi-filters `ColorOverlayFilter` only while `amount > 0`. Headless tests cover timing, pooling and attach/detach; they do not prove pixels. Needs a real GPU (or at least the swiftshader `gpu-verify.mjs` extended): white at amount 1, original texels at 0, alpha edge preserved (no halo on soft edges), stacking with a `shader_set` filter. Also the 50/200/1000 concurrent-flash cost benchmark (filter vs additive clone vs mesh, research 12 step 4).

## WGSL (WebGPU) programs: naga-validated only, never run on a GPU

Landed headlessly: importer emits `wgslFragmentSrc` next to `fragmentSrc` (build-time GLSL ES 1.00 to GLSL 450 rewrite, then `naga-wasm`, `packages/toolchain/src/glsl-es-to-wgsl.ts`); `CustomShaderFilter` builds a `GpuProgram` when given `wgslFragment` (vertex from `toFilterWgslVertexSource`); `RainGlassFilter` has a hand-ported WGSL fragment (`RainGlassWgsl.ts`); `RenderSystem` warns once when a filter with no WebGPU-compatible program is attached under WebGPU. Proven headless: naga parses and validates the generated and hand-written WGSL; `wgsl_reflect` reads the expected entry points and bind groups; pixi's own `GpuProgram` reflection shows the resources land in group 1 by name (nothing in the fallback group 99); the WGSL uniform struct order equals the JS `UniformGroup` order.

NOT verified (needs a real WebGPU browser, e.g. Chrome with `preference: ["webgpu"]`):

- Any actual WebGPU render of an imported shader or of the rain filter. Compare pixels against the WebGL path.
- That pixi's pipeline creation accepts the split vertex/fragment sources (separate modules, fragment declares only bindings it needs, vertex declares `gfu`), and that no bind-group-layout mismatch appears in the console.
- Uniform values reach the shader in the right slots (UBO layout is derived from the JS group order; a mismatch shows as wrong colours, not an error). Check `uTime`, a `vec3`, an `int`, `uResolution`/`uTint` in the rain filter.
- Rain: drop-map orientation and texel filtering under WebGPU (`textureSampleLevel` at level 0), the `@builtin(position)` noise (y is flipped relative to GL, only affects the fog dither), `uChroma` swizzled writes.
- Importer edge cases in real GameMaker shaders: shaders that fall back to GL-only (extra samplers, matrices, arrays, `gl_FragCoord`) get a warning at import and one runtime warning under WebGPU; check what fraction of a real project converts.
- naga's handling of `texture2D` inside non-uniform control flow (WGSL is strict about implicit-derivative `textureSample`); the converter emits `textureSample`, so a shader sampling inside an `if` on a per-pixel value may fail on the device compiler even though naga validated it.
- Blend-required filters (`uBackTexture`) are not supported by the WGSL path.

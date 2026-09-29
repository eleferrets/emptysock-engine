# 04 - Sprite-level shader_set: pixi v8 Mesh + Shader vs per-object Filter

Status: research only, nothing implemented. Source item: `gpu_followup_real_browser.md`, "Research pass" item 4.
Evidence legend: [repo] read in this repo; [web] confirmed on pixijs.com / pixijs GitHub this pass; [mem] from prior knowledge of pixi v8 source, NOT re-verified this pass (verify before coding).

## 1. Recommendation

Keep the Filter as the correct, general path. Add a Mesh path only for the narrow, very common shape: a plain (non nine-slice, non tiled) `Sprite` drawn with a registered importer shader, where the shader is a "passthrough position" shader (the importer already only accepts those). Gate it behind a per-shader eligibility check with the Filter as automatic fallback. Reasons:

- A Filter costs an offscreen render texture, a copy/blit, and a batch flush per filtered sprite (plus filter-area padding and resolution handling). Ten "hit flash" sprites (`shader_set(sh_white); draw_self()`) means ten filter passes per frame. A Mesh is one draw call with no extra target.
- But the Mesh path forfeits pixi sprite batching for those sprites, needs a second translation of the shader (sprite/mesh vertex contract, not filter contract), and does not work for GML shaders that sample anything other than the sprite's own texture region without extra work. So: opt-in by measurement, not a rewrite.
- Do step 1 (benchmark on a real GPU) before committing to steps 3+. Swiftshader timings are CPU rasterisation and prove nothing about cost [repo: rendering-and-pipeline.md].

## 2. Current state [repo]

- `systems/ShaderRegistry.ts`: module-level `Map<name, {vertexSrc, fragmentSrc}>` plus uniform values per shader id and a version counter.
- Importer `packages/toolchain/src/gms2-shader-import.ts` translates GLSL ES 1.00 to GLSL ES 3.00 in the pixi Filter contract: `in vec2 aPosition; in vec2 aUV; uniform mat3 uProjectionMatrix/uWorldTransformMatrix/uTransformMatrix`, `varying` to `in`/`out`, `texture2D` to `texture`, `gl_FragColor` to `out vec4 finalColor`, `gm_BaseTexture` to `uTexture`. It only accepts the standard `gm_Matrices[MATRIX_WORLD_VIEW_PROJECTION] * vec4(in_Position.xy,...)` vertex and texcoord/colour passthrough varyings; anything else throws `ShaderTranslationError` (reported "manual"). Colour varyings are replaced by `vec4(1.0)`.
- `CustomShaderFilter.ts` / `buildGmlShaderFilter(id)`: adapts the vertex to pixi's `filterVertexPosition` maths (the sprite-style vertex collapses a Filter quad). Declares uniforms up front through `UniformGroup`.
- `compat/gmlShaders.ts`: `shader_set`/`shader_reset` two paths. In Draw events via `ctx.drawTarget.setShader()` (`PixiGmlDrawTarget` sets `.filters=[filter]` on each sprite-shaped child until reset). Outside Draw, writes `Sprite.shader`, applied by `RenderPipeline._applySpriteShader()`. Uniform setters write to the entity's active shader; handle = uniform name; per shader id, not per entity.
- Known gaps [repo]: nine-slice, tiled, `Projection3D`, vector shapes and text on Draw `Graphics` are not filtered.
- Verified only on swiftshader WebGL2 (`gpu-verify.mjs`, `sh_white` on a real project).

## 3. pixi v8 API facts

- [web] `Mesh` = geometry + shader + GPU state. `new MeshGeometry({positions, uvs, indices, topology})`; positions 2 floats/vertex. Built-ins: `MeshSimple`, `MeshRope`, `MeshPlane`, `PerspectiveMesh`.
- [web] `Shader.from({ gl: {vertex, fragment}, resources: { uSampler: texture.source } })`. Docs show the `gl` key; a `gpu` key with WGSL exists alongside [mem].
- [web] MeshPipe keeps `localUniforms` (`uTransformMatrix` mat3, `uColor` vec4) updated per mesh in `execute()`, and branches on `meshData.batched` (batch vs direct draw).
- [mem] `Mesh.batched` is true only when no custom shader is set (texture-only meshes batch with sprites); a custom `shader` forces a non-batched direct draw, which breaks the sprite batch on both sides.
- [mem] For a custom Mesh shader on WebGL, pixi supplies global uniforms `uProjectionMatrix`, `uWorldTransformMatrix`, `uWorldColorAlpha`, `uResolution` (group `globalUniforms`) plus local `uTransformMatrix`, `uColor`; pixi's own mesh vertex is `in vec2 aPosition; in vec2 aUV; ... mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;`. Interesting: this is exactly what the importer's translated vertex already assumes (the Filter path is the odd one out). Verify names in `src/rendering/renderers/gl/shader/` and `mesh/shared/` before use.
- [mem] `GlProgram.from({vertex, fragment, name})`, `GpuProgram.from({vertex:{source,entryPoint}, fragment:{...}})`. `UniformGroup` needs declared types at construction; Shader `resources` is a map of name to group / texture source / sampler.
- [mem] Sprite atlas frames: `Texture` = source + `frame` + `uvs`; a Mesh built by hand must use the texture's UVs, or `uTextureMatrix` if the shader is `MeshSimple`-like.
- I could not fetch the pixi custom-shader guide page (404 at the guessed URL) and GitHub raw fetch gave only partial summaries. All [mem] items are unverified assumptions.

## 4. GML shader contract mapping

| GML feature | Filter today | Mesh design |
|---|---|---|
| `in_Position` (vec3) | replaced by filter position maths | map to `aPosition` vec2 (z=0); importer already rewrites |
| `in_Colour` (vec4) | `vec4(1.0)` constant | needs a real colour: Mesh has no per-vertex colour attribute by default; provide `uColor` (tint*alpha, premultiplied) or a 4th attribute. Importer currently drops it; keep `vec4(1.0)` then multiply by `uColor`, or feed `image_blend`/`image_alpha` |
| `in_TextureCoord` | `aUV` | `aUV` from texture uvs (atlas-correct) |
| `gm_BaseTexture` | `uTexture` = filter input (whole rendered region) | `uTexture` = the sprite's texture source; UV must be the atlas sub-rect (Mesh uvs), sampling outside the frame bleeds into neighbours |
| `gm_Matrices[...]` | rewritten | `uProjectionMatrix*uWorldTransformMatrix*uTransformMatrix` (same as importer) |
| `shader_get_uniform` | name string handle | unchanged |
| `shader_set_uniform_f/i/_array` | write into a `UniformGroup` on the Filter | write into a `UniformGroup` on the Mesh `Shader`; reuse `ShaderRegistry` version counter; one shared `Shader` per id (as Filter) |
| `shader_get_sampler_index`, `texture_set_stage` | unsupported | new: extra `resources` entries; out of scope for step 1 |
| `gm_AlphaTestEnabled`, `gm_FogStart` etc. | unsupported | out of scope; warn once |

Important semantic difference: a Filter sees a rendered image of the sprite (after its own tint/alpha and scale) in filter-area space with padding; a Mesh shader sees the raw texture with atlas UVs. For sh_white style colour-only shaders the results are identical. For shaders using `v_vTexcoord` offsets (outline, blur by pixel size) the Filter version computes texel size from the filter input, the Mesh version from the source texture: uniforms like `texel_size` set by the game are the same (GML would supply per-sprite texel size via `texture_get_texel_width`), so Mesh is closer to real GML. Outline shaders that draw outside the sprite bounds do not work on a Mesh (no padding); the Filter path gets padding for free. Fallback rule covers this.

## 5. Rendering behaviour

- Batching: each Mesh with custom shader is a non-batched draw [mem]: flushes the current batch before and after. N shaded sprites interleaved with unshaded sprites yields up to 2N+1 batches. Still cheaper than N filter passes (each Filter is also a batch break plus render-target switch plus copy).
- Draw order: a Mesh is a normal scene node; placing it in the same layer `Container` keeps `zIndex`/sort order with sibling sprites. Must not put it in a different container from the entity's sprite. No ordering change vs today.
- Render groups: a Mesh inside a `isRenderGroup` container is fine; the shader must consume `uWorldTransformMatrix` (global uniform) rather than assuming identity, else camera/group transforms are lost. Cameras here transform the stage [repo], so it must be honoured.
- Tint/alpha/blend: sprite `tint`, `alpha`, `blendMode` must be mirrored to the Mesh (`tint`, `alpha`, `blendMode` exist on Mesh [mem]). `advanced-blend-modes` (subtract etc., already imported) apply to Mesh too [mem]; verify on GPU.
- Sprite data sync: an entity keeps its `PixiSprite`; a Mesh replacement means hiding the sprite (`renderable=false`) and adding a sibling Mesh whose transform mirrors it, or swapping the tracked node type. Preferred: a small `ShaderMeshSprite extends Mesh` created lazily, sharing the sprite's `Texture` and updated in `_syncOne` (position, scale, rotation via same transform, anchor/pivot, texture frame changes, flip via negative scale).
- Sprite sheet/atlas: use `MeshGeometry` quad with positions from `texture.frame`/`orig` (trim!) and uvs from `texture.uvs`; a trimmed frame must be untrimmed with the sprite's `trim` offset or the image shifts. Animated frame switch = update uvs buffer, not new geometry.
- Nine-slice / tiling: not eligible (pixi `NineSliceSprite` / `TilingSprite` have their own geometry and shader). Fallback to Filter (unchanged behaviour: currently not filtered at all; keep as is initially, then Filter fallback is a free improvement).
- Text and surfaces under `shader_set`: `draw_text` (BitmapText/Text) and `draw_surface` (RenderTexture-backed sprite). Surface sprite: eligible as a plain Sprite with a texture source of the render texture (flip Y handling differs; test). Text: GML applies the shader to glyph quads with the font atlas as `gm_BaseTexture`. A BitmapText is many quads: not a single Mesh; use Filter fallback (cost: pass per text object) or defer. Vector shapes: no texture, unsupported both ways.
- Draw-event path (`PixiGmlDrawTarget`): `draw_self`, `draw_sprite`, `draw_sprite_ext` create sprite-shaped children; change `_shade` to create/reuse Mesh nodes from a per-frame pool instead of assigning `.filters`. Pool must be reset each frame like the existing draw children.

## 6. GLSL / WebGPU implications

- GameMaker shaders are GLSL ES 1.00. The importer's output is ES 3.00 for WebGL2 only. pixi v8 Mesh `Shader.from({gl})` gives WebGL; the WebGPU renderer needs a `gpu` (WGSL) program. There is no supported GLSL-to-WGSL path in pixi [mem]. Therefore under a WebGPU renderer both Filter and Mesh custom shaders fail unless a WGSL twin exists. Position: engine forces/keeps WebGL renderer (`preference: 'webgl'`) whenever any GML shader is registered; a GLSL to WGSL transpile (naga/tint via wasm) is a separate, large research item and out of scope here. Check what `RenderSystem` currently passes as `preference` [repo: not checked in this pass].
- WebGL1 fallback: pixi v8 requires WebGL2 for its default path; ES 1.00 shaders are irrelevant after the importer.
- Precision: keep `precision mediump float` insertion; mobile GPU mediump differences unchanged from Filter path.
- Uniform naming clash: Mesh global uniforms (`uColor`, `uTransformMatrix`) may collide with user uniform names; the importer must reserve/rename. Filter path has similar reserved names (`uTexture`).

## 7. Cost table (relative, per shaded sprite per frame; unmeasured, to be replaced by step 1 data)

| Cost | Per-sprite Filter (today) | Mesh + Shader | Unfiltered Sprite (batched) |
|---|---|---|---|
| Extra render target | 1 (filter texture, bounds + padding) | 0 | 0 |
| Draw calls | ~2-3 (draw into RT, blit back) plus batch flushes | 1 (+ 2 batch breaks) | ~0 amortised |
| Fill-rate | 2x+ sprite area (padding) | 1x | 1x |
| Memory/GC | pooled RT, filter state push/pop | 1 Mesh + 1 geometry per shaded sprite (pool it) | none |
| CPU | filter bounds calc per frame | vertex/uv buffer update on frame change | low |
| Batching | breaks batch | breaks batch | keeps |
| Capability | padding, post effects, arbitrary shader sampling of neighbours | exact texture UV, no padding, no neighbour bleed | n/a |
| Risk | proven on swiftshader | new, unproven | n/a |

## 8. Fallback rule (choose per draw, decided at registration and at sync)

Use Mesh only if ALL: renderer is WebGL; shader translated with `mesh` variant successfully; node is a plain `Sprite` (or surface sprite); no `filters` from post-process on that node; shader is not flagged `needsPadding` (heuristic: fragment samples `v_vTexcoord +/-` offsets or uniform named like `texel`/`outline`/`blur`, or writes alpha outside sampled texel); blend mode supported. Otherwise use Filter. Environment/kill switch: `Sprite.shaderMode: 'auto'|'filter'|'mesh'` (default `auto`) and a global setting for tests. Log once when falling back (matching `warnOnce`).

## 9. Design

1. `ShaderRegistry` entry gains optional `meshVertexSrc` (importer emits the mesh contract, which is the sprite-vertex form the importer already generates; i.e. the current translated vertex, not the Filter-adapted one) and `meshEligible: boolean`.
2. New `systems/ShaderMesh.ts` (pixi import): `buildGmlMeshShader(id)` returns a shared `Shader` (`Shader.from({gl:{vertex,fragment}, resources:{uTexture: <per-mesh source>, gmlUniforms: UniformGroup}})`). Note: texture is per sprite, so either one `Shader` per (shader id, texture source) cached in a WeakMap, or a `Shader` per Mesh sharing the same `UniformGroup` (recommended: share the UniformGroup, cheap Shader per mesh; verify that sharing works).
3. `ShaderMeshSprite`: quad geometry sync from Texture (frame, trim, uvs), pooled.
4. `RenderPipeline._applySpriteShader` and `PixiGmlDrawTarget._shade` choose Mesh or Filter through one function `attachGmlShader(node, id)`; the eligibility function is pure and unit-testable without pixi.
5. Uniform sync: same version counter; copy into the shared `UniformGroup` once per frame in `render()` (as `syncLayerGmlShaders` does).
6. Importer: emit both sources; add a table for reserved names; keep failing loudly with `ShaderTranslationError` for non-passthrough vertices.

## 10. Tests

Headless (vitest, mocked renderer):
- Eligibility function table (node type, mode, shader flags, renderer type) including fallback reasons.
- Importer output snapshot for both variants; reserved-name collision test; unchanged Filter output (regression).
- `attachGmlShader` picks Mesh/Filter; pool reuse; no allocation in steady state; `shader_reset` restores plain sprite; unregistered shader remains warn-once, unfiltered.
- Uniform version propagation to the shared group (read `.uniforms[name]`, per the earlier UniformGroup finding).
- Geometry math: trimmed atlas frame to positions/uvs, flip, anchor, rotation (pure function).
- Draw order: mesh sits in same container index as sprite.

GPU-only (`gpu-verify.mjs`, headless Chromium, then a real GPU):
- Pixel equality: `sh_white` via Mesh vs via Filter on the same real-project atlas sprite (tolerance for edge AA).
- Atlas neighbour bleed; trimmed frame position; animated frame switching.
- Tint/alpha/blend/`bm_subtract` on Mesh.
- Camera/render-group transform correctness (moving stage, zoom).
- Surface sprite under shader (Y flip); text falls back to Filter and still renders.
- WebGPU renderer behaviour (expect error/fallback to WebGL).
- Timing: 1, 50, 500 shaded sprites, Filter vs Mesh, on a real desktop and a real mobile GPU (not swiftshader).

## 11. Sweep steps (ordered, each independently committable)

| # | Step | Owner files | Gate |
|---|---|---|---|
| 1 | Real-GPU benchmark harness: N shaded sprites via Filter (baseline numbers, no Mesh yet). Decide go/no-go. | `packages/engine/scripts/gpu-*.mjs`, `docs/gpu-verify/` | numbers recorded |
| 2 | Verify [mem] pixi facts against installed pixi 8.21 source (Mesh.batched, global uniform names, sharing UniformGroup); note results in this doc | this doc only | facts confirmed |
| 3 | Pure eligibility + quad-geometry helpers with tests (no pixi) | new `systems/gmlShaderMode.ts` + test | unit tests |
| 4 | Importer emits mesh vertex + reserved-name check; Filter output unchanged | `packages/toolchain/src/gms2-shader-import.ts`, its test | snapshot |
| 5 | `ShaderRegistry` optional mesh fields | `systems/ShaderRegistry.ts`, test | unit |
| 6 | `ShaderMesh.ts`: shader/mesh construction + uniform sync | new `systems/ShaderMesh.ts`, test | unit + GPU pixel test |
| 7 | Wire `RenderPipeline._applySpriteShader` and `PixiGmlDrawTarget._shade` through `attachGmlShader`, default mode `filter` | `systems/RenderPipeline.ts` | existing shader tests unchanged |
| 8 | Flip default to `auto`; add `Sprite.shaderMode` | `components/Sprite.ts`, `RenderPipeline.ts`, docs decision entry | GPU parity test |
| 9 | Record decision in `docs/decisions/rendering-and-pipeline.md` and tick item in `gpu_followup_real_browser.md` | docs (only if allowed by the "docs are being redone" note in the followup) | |

Files owned by others touching this: `RenderPipeline.ts` (63 KB, contested by all sprite work; keep the edit to the two call sites), `compat/gmlShaders.ts` (no change expected).

## 12. Risks

- Benchmark shows Filter cost is acceptable at real sprite counts: then the Mesh path is unjustified complexity. Step 1 is the gate.
- Visual divergence between Mesh and Filter for shaders relying on padding/neighbour sampling: mitigated by heuristic plus explicit `shaderMode`; heuristic can misclassify.
- [mem] pixi internals may differ in 8.21 (uniform names, batching): step 2.
- Mesh loses batching: many distinct shaded sprites can be slower than expected if the sprite count is huge; pool and sort by shader is not possible without changing draw order.
- WebGPU: neither path works; needs an explicit renderer-selection policy.
- Two translations per shader doubles importer surface and test load.
- Mesh lifecycle leaks (geometry/shader/texture-source destroy) on scene swap; must be released with `_releaseMain`/`releaseOverlay` teardown [repo: per-Scene tracking].
- Colour semantics: `in_Colour` currently constant white; GML `image_blend`/`image_alpha` inside custom shaders would need real values for shaders that read `v_vColour` (common). Filter path has the same gap today; Mesh makes it fixable via `uColor`.

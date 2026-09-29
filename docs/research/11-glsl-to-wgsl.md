# 11. GLSL to WGSL: can the engine run GML shaders on WebGPU?

Status: research only. Date 2026-09-29. Pixi v8.21. Nothing in the repo changed except this file.

## Bottom line

A usable converter exists: **naga** (Rust, wgpu project) via the npm package **`naga-wasm`** (MIT OR Apache-2.0, 2.0 MB wasm, 30.1.0, updated 2026-09-17). It runs in Node, so it fits a **build-time step in the importer**. It does NOT accept GLSL ES 1.00 or 3.00 directly, only Vulkan-flavoured GLSL 450 (explicit `layout(location/set/binding)`, separate `texture2D` + `sampler`). So the pipeline is our own ES 1.00 to GLSL 450 rewrite (regex, we already do a similar one) and then naga to WGSL. Feasible, medium effort, best for simple sprite fragment shaders. Fallback if we decline: force `preference: "webgl"` in RenderSystem (line 211 today is `["webgpu","webgl"]`).

## What our shaders look like today

`packages/toolchain/src/gms2-shader-import.ts`:

- Input is GLSL ES 1.00: `attribute in_Position/in_Colour/in_TextureCoord`, `varying`, `gm_Matrices[...]`, `gm_BaseTexture`, `texture2D`, `gl_FragColor`, `precision`.
- `translateGms2ShaderToPixi` only accepts a passthrough vertex stage, else throws `ShaderTranslationError`. It emits ES 3.00 (`in/out`, `aPosition`, `aUV`, mat3 `uProjectionMatrix/uWorldTransformMatrix/uTransformMatrix`, `uTexture`, `finalColor`). The vertex output is a fixed template; only the varyings vary.
- `CustomShaderFilter.ts` builds `Filter({ glProgram, resources: { uniforms: UniformGroup } })`. There is no `gpuProgram` anywhere, so on the WebGPU renderer these filters have no program to run. The rain filter is GL-only for the same reason.
- So the real translation problem is the FRAGMENT shader plus a fixed vertex template, not arbitrary vertex code. That is the easy case for a converter.

## Verdict table

| Tool                                        | Maintained / license                                         | npm, wasm size                                            | GLSL input                                                                                                                                           | Node build step                | Browser             | Verdict                                                                            |
| ------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------- | ---------------------------------------------------------------------------------- |
| naga via `naga-wasm` 30.1.0                 | active (tracks wgpu major), MIT OR Apache-2.0                | yes, 2.0 MB wasm (~0.75 MB gzip)                          | GLSL 440/450/460 core only, Vulkan style. Rejected ES 1.00 (`varying`) and `#version 300 es` in my test                                              | yes (loads on import)          | yes, `await init()` | **Use, with an ES1 to 450 rewrite**                                                |
| Naga.js (yangfengzzz, Rust wasm)            | small hobby repo, not verified as published                  | unclear                                                   | same naga frontend                                                                                                                                   | unclear                        | yes                 | Skip, `naga-wasm` supersedes                                                       |
| `@webgpu/naga`                              | does not exist on npm (404)                                  | none                                                      | none                                                                                                                                                 | none                           | none                | n/a                                                                                |
| Tint (Dawn)                                 | very active, BSD-3                                           | no official npm/wasm package (`tint-wasm` 404)            | no GLSL frontend; SPIR-V reader is being removed/deprecated, WGSL is its input                                                                       | would need a native Dawn build | no                  | Not practical                                                                      |
| glslang + SPIRV-Cross / spirv-tools to WGSL | glslang active (BSD/Apache); SPIRV-Cross has no WGSL backend | `@webgpu/glslang` 0.0.15 (5 MB wasm, GLSL to SPIR-V only) | GLSL ES 1.00 accepted by glslang                                                                                                                     | yes                            | yes                 | Gives SPIR-V, but SPIR-V to WGSL then needs naga or tint anyway. No gain over naga |
| shaderc                                     | Google, Apache-2.0                                           | native only, no maintained npm wasm                       | GLSL to SPIR-V                                                                                                                                       | native                         | no                  | Skip                                                                               |
| `wgsl_reflect` 1.6.0                        | active, MIT                                                  | yes, ~3 MB unpacked                                       | WGSL only                                                                                                                                            | yes                            | yes                 | Not a converter. Useful AFTER conversion to read bind group / uniform layouts      |
| `glsl-transpiler` 3.0.3                     | stale (2024), MIT                                            | yes, 100 KB                                               | GLSL to JavaScript                                                                                                                                   | yes                            | yes                 | Wrong target                                                                       |
| `@use-gpu/glsl`                             | 404. `@use-gpu/shader` 0.20 exists (MIT)                     | 2 MB unpacked                                             | its own GLSL/WGSL link/bind system, not a converter                                                                                                  | yes                            | yes                 | Skip                                                                               |
| three.js TSL / `GLSLNodeParser`             | active, MIT                                                  | part of three                                             | GLSLNodeParser only parses to nodes for WebGL. Raw GLSL is not auto-portable to WebGPU                                                               | n/a                            | n/a                 | Not reusable with pixi                                                             |
| Pixi v8 itself                              | active, MIT                                                  | pixi.js                                                   | no GLSL to WGSL. You supply a `GlProgram` and/or `GpuProgram` (WGSL) separately; pixi's docs say to include a `gpuProgram` for dual-renderer support | n/a                            | n/a                 | Nothing to reuse                                                                   |

(Only naga-wasm was run. Other rows are from npm metadata plus search results; the Tint and three.js rows in particular were not verified against source.)

## Test in the scratchpad

Tool used: `naga-wasm` in `.../scratchpad/wgsl/` (not in the repo). Results:

- GLSL ES 1.00 (`varying`, `texture2D`, `gl_FragColor`): FAIL, `Expected end of file, found Identifier("varying")`.
- `#version 300 es`: FAIL, `Invalid version: 300`, `Invalid profile: es`, and combined `sampler2D` uniforms are not implemented (`Not implemented: variable qualifier`).
- GLSL 450 with separate texture/sampler: OK.

Note the API: `translate()` needed an options object I did not find; `parseGlsl(src, {stage:"fragment"})` then `validate` then `writeWgsl` worked.

Input (450 form, a hand-rewritten ES1 sprite fragment shader that inverts colour by `u_amount`):

```glsl
#version 450
layout(location=0) in vec2 v_vTexcoord;
layout(location=1) in vec4 v_vColour;
layout(location=0) out vec4 finalColor;
layout(set=0,binding=0) uniform U { float u_amount; };
layout(set=0,binding=1) uniform texture2D tex;
layout(set=0,binding=2) uniform sampler samp;
void main(){ vec4 c = v_vColour * texture(sampler2D(tex,samp), v_vTexcoord);
  finalColor = vec4(mix(c.rgb, vec3(1.0)-c.rgb, u_amount), c.a); }
```

Output (verbatim, trimmed only of blank lines):

```wgsl
struct U { u_amount: f32, }
struct FragmentOutput { @location(0) finalColor: vec4<f32>, }
var<private> v_vTexcoord_1: vec2<f32>;
var<private> v_vColour_1: vec4<f32>;
var<private> finalColor: vec4<f32>;
@group(0) @binding(0) var<uniform> global: U;
@group(0) @binding(1) var tex: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;
fn main_1() {
    var c: vec4<f32>;
    let _e7 = v_vColour_1;
    let _e8 = v_vTexcoord_1;
    let _e9 = textureSample(tex, samp, _e8);
    c = (_e7 * _e9);
    ...
    let _e19 = global.u_amount;
    let _e21 = mix(_e12.xyz, (vec3(1f) - _e16.xyz), vec3(_e19));
    finalColor = vec4<f32>(_e21.x, _e21.y, _e21.z, _e22.w);
    return;
}
@fragment
fn main(@location(0) v_vTexcoord: vec2<f32>, @location(1) v_vColour: vec4<f32>) -> FragmentOutput {
    v_vTexcoord_1 = v_vTexcoord;
    v_vColour_1 = v_vColour;
    main_1();
    let _e17 = finalColor;
    return FragmentOutput(_e17);
}
```

Quality: correct and validated by naga, machine-looking (SSA temporaries, private globals, entry point named `main` wrapping `main_1`). Fine for a machine-generated asset.

## Recommended approach: build time, in the importer

Reasons: 2 MB wasm stays out of the shipped game; failures surface at import (matching the existing `ShaderTranslationError` "report as manual" pattern); the output is a static string beside the existing `vertexSrc/fragmentSrc`. Runtime conversion is only needed for the IDE ShaderEditor (user-typed GLSL); it is optional and can lazy-load `naga-wasm` in the IDE only (engine must stay DOM-free and the wasm would live in `apps/ide`, not `packages/engine`).

## Integration sketch with pixi v8

1. Importer: ES1 source to GLSL 450 (Vulkan style) by text rewrite:
   - `varying X` to `layout(location=N) in X` (fragment). Location order comes from the vertex varying list we already parse (`extractVaryings`).
   - `gl_FragColor` to `layout(location=0) out vec4 finalColor`.
   - `uniform sampler2D gm_BaseTexture` to `layout(set=1,binding=1) uniform texture2D uTexture; layout(set=1,binding=2) uniform sampler uSampler;` and rewrite `texture2D(gm_BaseTexture, uv)` to `texture(sampler2D(uTexture,uSampler), uv)`. Other user samplers get the same treatment.
   - Loose `uniform float u_x;` lines become members of one `layout(set=1,binding=0) uniform U { ... }` block (naga requires uniform blocks, not loose uniforms in Vulkan GLSL).
   - Drop `precision` lines.
2. naga: `parseGlsl(..., {stage:"fragment"})`, `validate`, `writeWgsl`. Compile the vertex stage from a hand-written WGSL template (not converted), mirroring pixi's own filter vertex (`mainVertex`).
3. Emit alongside the existing strings: `wgslFragmentSrc`, plus a uniform-layout list (name, type, offset; can come from `wgsl_reflect` or from our own declaration order).
4. `CustomShaderFilter`: when `wgslFragmentSrc` exists, pass `gpuProgram: GpuProgram.from({ vertex:{source:VS,entryPoint:"mainVertex"}, fragment:{source:FS,entryPoint:"main"}})` in the Filter options next to `glProgram`. Add a UniformGroup with the same uniform names, declared types (`f32`, `vec2<f32>`...) so pixi builds the UBO with matching std140 offsets. Pixi selects whichever program matches the active renderer.

Pixi v8 filter WGSL conventions to confirm in the pixi 8.21 source before coding (I could not fetch a concrete example from the docs): pixi's filter system puts its own global filter uniforms and the input texture/sampler in group 0, and the filter's own `resources` in group 1. The naga output above therefore has to be forced to `set=1` for user resources (as in step 1) and the entry point/inputs must match the filter vertex output (`@location` order, and whether pixi's vertex passes `position` builtin plus a uv at location 0). Also, in pixi the input texture is bound in group 0 by the filter system, so the importer should map `gm_BaseTexture` to that binding rather than declaring a new one. Verify this against `node_modules/pixi.js/lib/filters` (`Filter`, `FilterSystem`, `defaultFilter.wgsl`) first; it is the main unknown.

## Limitations

- Uniform mapping: WGSL/WebGPU needs one UBO with std140-like alignment. Our `parseShaderUniforms` and `setUniform(name, value)` path works by name, so keep names and add type info. `vec3` members pad to 16 bytes, `float[]` arrays have 16-byte stride, and `mat3` is 3x vec4 columns. Pixi's UniformGroup handles this if declared types are exact.
- Samplers: WebGPU splits texture and sampler; each `sampler2D` becomes two bindings. GameMaker `gm_BaseTexture` plus any extra `sampler2D` user textures (set via `texture_set_stage`) need a resource entry each.
- Not in Vulkan-GLSL/naga: `gl_FragData`, `texture2DLod` extensions, `dFdx` needs care (uniform control flow rules in WGSL), loops with non-constant bounds are fine in naga but strict in WGSL for `textureSample` inside non-uniform control flow (compile error).
- Vertex logic other than the passthrough is already rejected by the importer; keep that.
- Arrays of uniforms (`gm_Matrices`) do not survive, but the fixed vertex template removes the need.
- Output name/entry mangling (`main_1`, `global`) is harmless but makes diffs noisy; do not hand-edit generated files.
- Pixel-level parity between GL and GPU paths (precision: `mediump` is ignored in WGSL, everything is f32) may differ slightly.
- Unverified: none of this has run on a real WebGPU device; the repo already tracks unverified-on-GPU items in `gpu_followup_real_browser.md`.

## Committable sweep steps (in order)

1. `packages/toolchain` (owner: importer): add `naga-wasm` devDependency; new `src/glsl-es-to-wgsl.ts` with the ES1 to 450 rewrite and naga call; unit tests on fixtures (sprite tint, colour invert, two-texture). Conventional commit `feat(toolchain): translate gms2 fragment shaders to wgsl via naga`.
2. `packages/toolchain/src/gms2-shader-import.ts` (owner: importer): call step 1 inside `buildShaderAsset`, emit `wgslFragmentSrc` + uniform layout; on naga error emit GLSL only and log "gl-only". Regenerate tests.
3. `packages/types` (owner: types): extend the shader descriptor and registry entry type with optional `wgslFragmentSrc`, `wgslUniforms`. Export via `packages/engine/src/index.ts` (keep `dist-types` in sync).
4. `packages/engine/src/systems/CustomShaderFilter.ts` (owner: engine render): add optional `gpuProgram` + matching resources; verify bind group numbering with pixi 8.21 sources; keep glProgram path unchanged.
5. `packages/engine` render pipeline: `registerGmlShader` path passes the WGSL through; RenderSystem keeps `["webgpu","webgl"]` only when all registered filters have WGSL, otherwise picks `webgl`.
6. Rain filter: hand-write its WGSL (it is not GameMaker-derived); separate commit.
7. Real-browser check on WebGPU (Chrome) of one converted shader; record results in `gpu_followup_real_browser.md`.
8. Optional: `apps/ide` lazy-loads `naga-wasm` to compile ShaderEditor text to WGSL at runtime.

## Risks

- Naga rejects ES 1.00/3.00 so our regex rewrite is now a compiler front-end we must maintain; unusual shaders (loops, `#define` tricks, functions with `inout` on samplers) will fail. Mitigation: fall back to GL-only and flag "manual".
- The bind group/entry-point contract with pixi's filter pipeline is unconfirmed (biggest risk).
- `naga-wasm` is a single-maintainer wrapper around wgpu's naga; its major version tracks naga, whose GLSL frontend is documented as incomplete. Pin the version and vendor test fixtures.
- 2 MB wasm in the IDE bundle if runtime conversion is added.
- Engine must not import DOM/Tauri; the converter must stay in toolchain or IDE, never `packages/engine`.
- Decision fallback (zero effort): set `preference: "webgl"` in `RenderSystem.ts:211` and keep all GL-only filters (including rain). Costs the WebGPU path but no new tooling.

## Sources

- naga-wasm: https://www.npmjs.com/package/naga-wasm , https://github.com/kekkon-nexus/naga-wasm
- Naga.js: https://github.com/yangfengzzz/Naga.js
- naga (wgpu): https://github.com/gfx-rs/wgpu/tree/trunk/naga
- @webgpu/glslang: https://www.npmjs.com/package/@webgpu/glslang
- wgsl_reflect: https://www.npmjs.com/package/wgsl_reflect
- glsl-transpiler: https://www.npmjs.com/package/glsl-transpiler
- @use-gpu/shader: https://www.npmjs.com/package/@use-gpu/shader
- Pixi v8 filters guide: https://pixijs.com/8.x/guides/components/filters.md
- Tint SPIR-V reader removal: https://dawn.googlesource.com/tint/+/9545fb76b66df0ed27e0033f5764ccd9d83cb3cd

## Verified against pixi 8.21 source

Read from `node_modules/.pnpm/pixi.js@8.21.0/node_modules/pixi.js/lib` (`filters/Filter.mjs`, `filters/FilterSystem.mjs`, `filters/defaults/{alpha,displacement,passthrough}/*.wgsl.mjs`, `rendering/renderers/shared/shader/Shader.mjs`, `rendering/renderers/gpu/shader/{GpuProgram.mjs,utils/*}`). This closes the "biggest risk" above, on paper only; nothing here ran on a GPU.

- **Program shape.** `GpuProgram.from({ vertex:{source, entryPoint}, fragment:{source, entryPoint} })`. Pixi's own filters use one WGSL string for both stages with entry points `mainVertex` and `mainFragment`. Separate vertex and fragment sources are also supported (`GpuProgram` de-duplicates bindings declared in both via `removeStructAndGroupDuplicates`), so a generated fragment (entry `main`) can pair with a template vertex.
- **Vertex inputs/outputs.** `mainVertex(@location(0) aPosition: vec2<f32>) -> VSOutput`, `VSOutput = { @builtin(position) position: vec4<f32>, @location(0) uv: vec2<f32>, ...more @location(n) }`. The fragment's `@location(n)` inputs must match the vertex outputs. Position maths is `filterVertexPosition`, uv is `aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw)` (same as the GL `defaultFilter.vert`).
- **Bind group 0 (owned by `FilterSystem`, set every apply).** binding 0 = `var<uniform> gfu: GlobalFilterUniforms` with fields in this exact order, all `vec4<f32>`: `uInputSize, uInputPixel, uInputClamp, uOutputFrame, uGlobalFrame, uOutputTexture`; binding 1 = `var uTexture: texture_2d<f32>` (the filter input); binding 2 = `var uSampler: sampler`; binding 3 = back texture, only when `blendRequired`. The filter's own WGSL must declare these exact bindings (names are conventional; the binding numbers and types are the contract).
- **Bind group 1 (the filter's own `resources`).** Resources are wired to the WGSL by NAME: `Shader` runs a regex (`extractStructAndGroups`) over the WGSL, builds a name to (group, binding) map, and for each key of `resources` finds that variable name. Consequences: (1) the `resources` key must equal the WGSL `var` name (pixi's own: `filterUniforms`, `alphaUniforms`, `uMapTexture`, `uMapSampler`); (2) a key with no matching WGSL variable is parked in a dummy group 99 (with a console warning only when there is no `glProgram`); (3) the regex needs `@group(N) @binding(M) var<uniform> name: Type;` (one space after `var<...>`), which naga's output satisfies.
- **UBO layout is JS-declared, not reflected.** The `UniformGroup` given as a resource is laid out by `createUboElementsWGSL` in the declaration order of its JS entries, with WGSL alignment (vec3 align 16 size 12, so a following f32 packs at offset 12, same as WGSL). So the JS uniform entries must appear in the same order and types as the WGSL struct members, or values land in the wrong slots silently. Mitigation used here: the generated struct always begins with `uTime` (matching `CustomShaderFilter`'s JS group, which always declares `uTime` first) followed by the user uniforms in `parseShaderUniforms` order.
- **Conclusion for the naga path.** The generated fragment must: declare `@group(0) @binding(1) uTexture` / `@binding(2) uSampler`; put user uniforms in one block bound at `@group(1) @binding(0)`; use the block instance name that equals the resource key (`uniforms`, now the key in `CustomShaderFilter`); take `@location(n)` varyings numbered by the vertex varying order; and be paired with a vertex source that declares `gfu` at group 0 binding 0 and outputs the same locations.
- Filters that are GL-only still get a `compatibleRenderers` mask of WEBGL only (`Shader` sets it from which programs exist), so under the WebGPU renderer the filter is skipped, which is the silent no-op that was measured.

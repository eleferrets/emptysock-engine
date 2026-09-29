# 12 - Existing pixi v8 options for sprite hit-flash / dissolve / outline

Status: research only, nothing implemented. Follows 04 (Filter vs Mesh+Shader) and 03 (ecosystem audit).
Evidence legend: [repo] read in this repo; [web] read on pixijs.io/filters or the pixijs/filters GitHub source
this session; [know] pixi v8 behaviour from prior knowledge, NOT re-verified this session (confirm before coding).

## 1. Answer

Yes, something exists, and the engine already ships it. `pixi-filters ^6.1.5` is a dependency [repo:
packages/engine/package.json] and it exports `ColorOverlayFilter`, a single-pass, alpha-preserving
"paint the sprite this colour at N%" filter. That is exactly a white flash. There is no dedicated
"FlashFilter" or maintained "sprite-effects" plugin for v8 that I found; do not depend on tween/effect
plugins for this. The engine's own `CustomShaderFilter` is still needed, but only for GML `shader_set`.

## 2. Built-in pixi v8 mechanisms

| Mechanism | White flash? | Notes |
|---|---|---|
| `Sprite.tint` | No | Multiplies texels by the tint (max 0xFFFFFF = unchanged). It can darken or colourise, never brighten past the texture. [know] |
| `blendMode = 'add'` on a second white-tinted clone sprite drawn on top | Yes, but leaks | Adds white over transparent-edged pixels too unless the clone shares the texture alpha; ok for opaque-edged art, wrong for soft edges. Costs an extra sprite, but it still batches. [know] |
| Mask (`setMask`) | n/a | Could clip an overlay to the sprite shape, but a mask is a stencil/render pass, more expensive than a filter. Not worth it. [know] |
| `ColorMatrixFilter` (`brightness(b)`, `tint(c)`, `saturate`) | Yes | One pass. `brightness` multiplies rgb; a matrix with offset column to +1 gives white. Works with premultiplied alpha but you must set the offset column carefully. Already imported in RenderSystem [repo]. |
| `AlphaFilter` | No | Group opacity only. Use `Container.alpha` unless you need group alpha without overlap. |
| `BlurFilter` | No | Multi-pass separable (horizontal+vertical, plus quality passes). Expensive; not for per-sprite effects. |
| `DisplacementFilter` | No | Needs a displacement sprite/texture; heat-shimmer style. |

## 3. pixi-filters v6 catalogue [web: pixijs.io/filters docs]

AdjustmentFilter, AdvancedBloomFilter, AsciiFilter, BackdropBlurFilter, BevelFilter, BloomFilter,
BulgePinchFilter, ColorGradientFilter, ColorMapFilter, ColorOverlayFilter, ColorReplaceFilter,
ConvolutionFilter, CrossHatchFilter, CRTFilter, DotFilter, DropShadowFilter, EmbossFilter, GlitchFilter,
GlowFilter, GodrayFilter, GrayscaleFilter, HslAdjustmentFilter, KawaseBlurFilter, MotionBlurFilter,
MultiColorReplaceFilter, OldFilmFilter, OutlineFilter, PixelateFilter, RadialBlurFilter, ReflectionFilter,
RGBSplitFilter, ShockwaveFilter, SimpleLightmapFilter, SimplexNoiseFilter, TiltShiftFilter, TwistFilter,
ZoomBlurFilter. No FlashFilter, no DissolveFilter.

Relevant to sprites and cost (pass counts are [know] unless stated):

- `ColorOverlayFilter` (`color`, `alpha`): 1 pass. Fragment [web: pixijs/filters src/color-overlay]:
  `finalColor = vec4(mix(c.rgb, uColor * c.a, uAlpha), c.a)`. It is premultiplied-correct, keeps the
  silhouette, and `alpha` is the flash amount 0..1. This is the hit-flash primitive.
- `AdjustmentFilter` (gamma, contrast, saturation, brightness, r/g/b, alpha): 1 pass. Brightness >1 blows
  out towards white, so it is a soft flash alternative; un-premultiplies per pixel [web].
- `OutlineFilter` (thickness, color, quality): 1 pass, but samples `angleStep` taps per texel, so cost rises
  with `thickness`/`quality`. Needs filter padding (auto). Already used by RenderSystem [repo].
- `GlowFilter`: 1 pass, tap count scales with `quality`/`distance`.
- `DropShadowFilter`: blur passes plus composite; several passes. Avoid per sprite.
- `HslAdjustmentFilter`, `ColorReplaceFilter`, `MultiColorReplaceFilter`, `GrayscaleFilter`: 1 pass;
  palette-swap and desaturate-on-death.
- `SimplexNoiseFilter`/noise: a dissolve needs a threshold on a noise texture with alpha discard; none of
  the shipped filters does that, so a dissolve stays a small custom fragment.

## 4. Other libraries

Searched for maintained v8 hit-flash / dissolve / outline packages. Nothing credible beyond pixi-filters:
older `@pixi/*` and `pixi-tween`-era plugins target v5/v6 APIs, and shader "collections" are GLSL
snippets, not packages. Tween libraries (gsap, the engine's own timeline) can drive
`ColorOverlayFilter.alpha`; they do not supply the shader. Recommend no new dependency.
(Web search was not run this session; the negative is from the filters catalogue plus prior knowledge.
Do one `npm search pixi v8 filter` before closing this out.)

## 5. Engine today [repo]

- `systems/CustomShaderFilter.ts` builds a `Filter` from GML-imported GLSL (`ShaderRegistry`), with the
  `uTexture`/`uTime` contract and vertex adaptation from sprite-quad to filter-quad. Used by RenderSystem
  (layer filters, IDE preview, `buildGmlShaderFilter`) and `RainGlassFilter`.
- `compat/gmlShaders.ts`: `shader_set`/`shader_reset` bind a shared per-shader Filter to the entity.
- RenderSystem already imports `ColorMatrixFilter`, `BlurFilter`, and `OutlineFilter`/`SimpleLightmapFilter`
  from pixi-filters, so stock filters are established practice.
- Tests: `CustomShaderFilter.test.ts`, `ShaderRegistry.test.ts`, `gmlShaders.test.ts`,
  `RenderPipelineShaders.test.ts` (headless). GPU: `gpu-verify.mjs` on swiftshader only (per 04).

## 6. Cost: filters vs batching

Pixi does not batch filtered containers. Each filtered display object ends the current batch, renders its
subtree to a pooled render texture, runs the filter pass(es), and blits back [know]. With N flashing
sprites that is N batch breaks and N offscreen render passes per frame, while unfiltered sprites still
batch into a few draw calls. A Mesh+Shader sprite also leaves the sprite batcher (04) but skips the
offscreen texture and the blit; it is the cheaper draw per flashing sprite, at the price of a bespoke
path. Tint changes cost nothing (batch attribute).

Practical rule: a handful of concurrent flashes (player, a few hit enemies, flashes last 60-150 ms) is
fine with `ColorOverlayFilter`. Hundreds of simultaneous flashing sprites (bullet-hell, swarm hits) is
where Filter falls over and the 04 Mesh path is justified. Nobody has measured this on a real GPU;
04 step 1 (real-GPU benchmark) gates the decision.

## 7. Recommendations

(a) Engine-native hit-flash. Add a `SpriteFlash` component (`color`, `amount`, `duration`, `easing`).
A system drives it. Implementation tiers, cheapest first:
  1. Use one shared `ColorOverlayFilter` per (colour) and set `alpha`? No: filter uniforms are per-instance
     and the filter is bound per sprite, so allocate one instance per flashing entity from a small pool and
     return it to the pool at `amount == 0` (filters removed, zero cost when idle).
  2. Optional fast path for opaque-edge sprites: additive white clone (`blendMode 'add'`), batchable.
  3. Escalate to Mesh+Shader only if the GPU benchmark shows the filter path failing the "many flashes"
     case.
Keep the API backend-agnostic (`SpriteFlash`), so swapping tier 1 for a mesh later touches one system.

(b) GML `shader_set` stays on Filter (per 04). Arbitrary user GLSL cannot be mapped onto stock filters.
Note `sh_white`-style GML flash shaders (`shader_set(sh_white)`) can be recognised in the importer and
mapped to `SpriteFlash(amount = 1, white)`. That is an optional optimisation, and only if the shader
source is provably a solid-colour output; otherwise leave it as a Filter.

(c) Do not drop `CustomShaderFilter`. Its job (compile user GLSL with the `uTexture`/`uTime` contract and
vertex adaptation) has no equivalent in pixi-filters. Keep it, but do not add new built-in effects to it:
new engine-authored effects (flash, outline, palette swap, desaturate) should use `pixi-filters` classes.

## 8. Sweep steps

1. Confirm `ColorOverlayFilter` behaviour against installed 6.1.5 source (`node_modules/pixi-filters`), including
   premultiplied alpha and auto padding. Owner: engine render (`RenderSystem.ts`). Headless-readable.
2. Add `SpriteFlash` component + `SpriteFlashSystem` and filter pool. Owner: `packages/engine/src/systems/`
   (new file, plus export in `index.ts`); RenderSystem/RenderPipeline only gets a hook to attach/detach the
   pooled filter. Tests, headless: component timing/easing math, pool acquire/release, filter removed at
   zero, no leak on entity destroy (mock renderer as in `RenderPipelineShaders.test.ts`).
3. GPU verification: extend `gpu-verify.mjs` with a flash case, check pixel readback (white at amount 1,
   original at 0, alpha edge preserved). Swiftshader only proves correctness, not cost.
4. Real-GPU benchmark (04 step 1) with 50/200/1000 concurrent flashes: filter vs additive clone vs mesh.
   Owner: whoever has hardware (manual, not CI).
5. Optional importer pass: detect solid-colour flash shaders and emit `SpriteFlash`. Owner:
   `packages/toolchain/src/gms2-shader-import.ts`; headless golden tests on translated output.
6. Docs: update 03/04 cross-references; note the negative result on plugin libraries.

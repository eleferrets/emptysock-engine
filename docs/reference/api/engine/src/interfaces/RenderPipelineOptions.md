[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / RenderPipelineOptions

# Interface: RenderPipelineOptions

Defined in: engine/src/systems/RenderPipeline.ts:101

## Extends

- `Omit`\<[`RenderSystemOptions`](RenderSystemOptions.md), `"layerSystem"`\>

## Properties

### antialias?

> `optional` **antialias?**: `boolean`

Defined in: engine/src/systems/RenderSystem.ts:131

#### Inherited from

[`RenderSystemOptions`](RenderSystemOptions.md).[`antialias`](RenderSystemOptions.md#antialias)

***

### backgroundColor?

> `optional` **backgroundColor?**: `number`

Defined in: engine/src/systems/RenderSystem.ts:130

#### Inherited from

[`RenderSystemOptions`](RenderSystemOptions.md).[`backgroundColor`](RenderSystemOptions.md#backgroundcolor)

***

### fonts?

> `optional` **fonts?**: [`FontRegistry`](../classes/FontRegistry.md)

Defined in: engine/src/systems/RenderPipeline.ts:110

Font registry consulted for bitmap fonts (`FontRegistry.registerBitmap`) when `draw_set_font`/`draw_text` runs. Usually `game.fonts`; can also be set later via `attachFonts()`.

***

### gpuTier?

> `optional` **gpuTier?**: `"potato"` \| `"low"` \| `"mid"` \| `"high"` \| `"ultra"`

Defined in: engine/src/systems/RenderSystem.ts:140

When provided (and `antialias`/`resolution` are not explicitly set),
caps resolution and disables antialiasing below "mid" tier so weak GPUs
(older mobile, integrated) don't pay full fill-rate cost. See
gpuTierRenderDefaults() in ViewportSystem.ts for the thresholds.

#### Inherited from

[`RenderSystemOptions`](RenderSystemOptions.md).[`gpuTier`](RenderSystemOptions.md#gputier)

***

### height?

> `optional` **height?**: `number`

Defined in: engine/src/systems/RenderSystem.ts:129

#### Inherited from

[`RenderSystemOptions`](RenderSystemOptions.md).[`height`](RenderSystemOptions.md#height)

***

### layers?

> `optional` **layers?**: [`LayerSystem`](../classes/LayerSystem.md)

Defined in: engine/src/systems/RenderPipeline.ts:106

Supply a LayerSystem to share with other code; a fresh one is created otherwise.

***

### preference?

> `optional` **preference?**: readonly (`"webgpu"` \| `"webgl"`)[]

Defined in: engine/src/systems/RenderSystem.ts:145

Renderer backends to try, in order. Default `["webgpu", "webgl"]`; pass
`["webgl"]` to skip WebGPU (several filters only have a GLSL program).

#### Inherited from

[`RenderSystemOptions`](RenderSystemOptions.md).[`preference`](RenderSystemOptions.md#preference)

***

### resolution?

> `optional` **resolution?**: `number`

Defined in: engine/src/systems/RenderSystem.ts:132

#### Inherited from

[`RenderSystemOptions`](RenderSystemOptions.md).[`resolution`](RenderSystemOptions.md#resolution)

***

### textureLoader?

> `optional` **textureLoader?**: [`TextureLoader`](../type-aliases/TextureLoader.md)

Defined in: engine/src/systems/RenderPipeline.ts:108

Override how texture paths resolve to PixiJS textures — defaults to `Assets.load`.

***

### width?

> `optional` **width?**: `number`

Defined in: engine/src/systems/RenderSystem.ts:128

#### Inherited from

[`RenderSystemOptions`](RenderSystemOptions.md).[`width`](RenderSystemOptions.md#width)

[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / RenderPipelineOptions

# Interface: RenderPipelineOptions

Defined in: engine/src/systems/RenderPipeline.ts:100

## Extends

- `Omit`\<`RenderSystemOptions`, `"layerSystem"`\>

## Properties

### antialias?

> `optional` **antialias?**: `boolean`

Defined in: engine/src/systems/RenderSystem.ts:131

#### Inherited from

`Omit.antialias`

***

### backgroundColor?

> `optional` **backgroundColor?**: `number`

Defined in: engine/src/systems/RenderSystem.ts:130

#### Inherited from

`Omit.backgroundColor`

***

### fonts?

> `optional` **fonts?**: [`FontRegistry`](../classes/FontRegistry.md)

Defined in: engine/src/systems/RenderPipeline.ts:109

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

`Omit.gpuTier`

***

### height?

> `optional` **height?**: `number`

Defined in: engine/src/systems/RenderSystem.ts:129

#### Inherited from

`Omit.height`

***

### layers?

> `optional` **layers?**: [`LayerSystem`](../classes/LayerSystem.md)

Defined in: engine/src/systems/RenderPipeline.ts:105

Supply a LayerSystem to share with other code; a fresh one is created otherwise.

***

### preference?

> `optional` **preference?**: readonly (`"webgpu"` \| `"webgl"`)[]

Defined in: engine/src/systems/RenderSystem.ts:145

Renderer backends to try, in order. Default `["webgpu", "webgl"]`; pass
`["webgl"]` to skip WebGPU (several filters only have a GLSL program).

#### Inherited from

`Omit.preference`

***

### resolution?

> `optional` **resolution?**: `number`

Defined in: engine/src/systems/RenderSystem.ts:132

#### Inherited from

`Omit.resolution`

***

### textureLoader?

> `optional` **textureLoader?**: [`TextureLoader`](../type-aliases/TextureLoader.md)

Defined in: engine/src/systems/RenderPipeline.ts:107

Override how texture paths resolve to PixiJS textures — defaults to `Assets.load`.

***

### width?

> `optional` **width?**: `number`

Defined in: engine/src/systems/RenderSystem.ts:128

#### Inherited from

`Omit.width`

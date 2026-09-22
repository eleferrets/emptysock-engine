[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / RenderPipelineOptions

# Interface: RenderPipelineOptions

Defined in: [engine/src/systems/RenderPipeline.ts:56](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/RenderPipeline.ts#L56)

## Extends

- `Omit`\<[`RenderSystemOptions`](RenderSystemOptions.md), `"layerSystem"`\>

## Properties

### antialias?

> `optional` **antialias?**: `boolean`

Defined in: [engine/src/systems/RenderSystem.ts:15](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/RenderSystem.ts#L15)

#### Inherited from

[`RenderSystemOptions`](RenderSystemOptions.md).[`antialias`](RenderSystemOptions.md#antialias)

***

### backgroundColor?

> `optional` **backgroundColor?**: `number`

Defined in: [engine/src/systems/RenderSystem.ts:14](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/RenderSystem.ts#L14)

#### Inherited from

[`RenderSystemOptions`](RenderSystemOptions.md).[`backgroundColor`](RenderSystemOptions.md#backgroundcolor)

***

### gpuTier?

> `optional` **gpuTier?**: `"potato"` \| `"low"` \| `"mid"` \| `"high"` \| `"ultra"`

Defined in: [engine/src/systems/RenderSystem.ts:24](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/RenderSystem.ts#L24)

When provided (and `antialias`/`resolution` are not explicitly set),
caps resolution and disables antialiasing below "mid" tier so weak GPUs
(older mobile, integrated) don't pay full fill-rate cost. See
gpuTierRenderDefaults() in ViewportSystem.ts for the thresholds.

#### Inherited from

[`RenderSystemOptions`](RenderSystemOptions.md).[`gpuTier`](RenderSystemOptions.md#gputier)

***

### height?

> `optional` **height?**: `number`

Defined in: [engine/src/systems/RenderSystem.ts:13](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/RenderSystem.ts#L13)

#### Inherited from

[`RenderSystemOptions`](RenderSystemOptions.md).[`height`](RenderSystemOptions.md#height)

***

### layers?

> `optional` **layers?**: [`LayerSystem`](../classes/LayerSystem.md)

Defined in: [engine/src/systems/RenderPipeline.ts:61](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/RenderPipeline.ts#L61)

Supply a LayerSystem to share with other code; a fresh one is created otherwise.

***

### resolution?

> `optional` **resolution?**: `number`

Defined in: [engine/src/systems/RenderSystem.ts:16](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/RenderSystem.ts#L16)

#### Inherited from

[`RenderSystemOptions`](RenderSystemOptions.md).[`resolution`](RenderSystemOptions.md#resolution)

***

### textureLoader?

> `optional` **textureLoader?**: [`TextureLoader`](../type-aliases/TextureLoader.md)

Defined in: [engine/src/systems/RenderPipeline.ts:63](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/RenderPipeline.ts#L63)

Override how texture paths resolve to PixiJS textures — defaults to `Assets.load`.

***

### width?

> `optional` **width?**: `number`

Defined in: [engine/src/systems/RenderSystem.ts:12](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/RenderSystem.ts#L12)

#### Inherited from

[`RenderSystemOptions`](RenderSystemOptions.md).[`width`](RenderSystemOptions.md#width)

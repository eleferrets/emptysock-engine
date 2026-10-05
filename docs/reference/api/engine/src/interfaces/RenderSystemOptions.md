[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / RenderSystemOptions

# Interface: RenderSystemOptions

Defined in: engine/src/systems/RenderSystem.ts:127

## Properties

### antialias?

> `optional` **antialias?**: `boolean`

Defined in: engine/src/systems/RenderSystem.ts:131

***

### backgroundColor?

> `optional` **backgroundColor?**: `number`

Defined in: engine/src/systems/RenderSystem.ts:130

***

### gpuTier?

> `optional` **gpuTier?**: `"potato"` \| `"low"` \| `"mid"` \| `"high"` \| `"ultra"`

Defined in: engine/src/systems/RenderSystem.ts:140

When provided (and `antialias`/`resolution` are not explicitly set),
caps resolution and disables antialiasing below "mid" tier so weak GPUs
(older mobile, integrated) don't pay full fill-rate cost. See
gpuTierRenderDefaults() in ViewportSystem.ts for the thresholds.

***

### height?

> `optional` **height?**: `number`

Defined in: engine/src/systems/RenderSystem.ts:129

***

### layerSystem?

> `optional` **layerSystem?**: [`LayerSystem`](../classes/LayerSystem.md)

Defined in: engine/src/systems/RenderSystem.ts:133

***

### preference?

> `optional` **preference?**: readonly (`"webgpu"` \| `"webgl"`)[]

Defined in: engine/src/systems/RenderSystem.ts:145

Renderer backends to try, in order. Default `["webgpu", "webgl"]`; pass
`["webgl"]` to skip WebGPU (several filters only have a GLSL program).

***

### resolution?

> `optional` **resolution?**: `number`

Defined in: engine/src/systems/RenderSystem.ts:132

***

### width?

> `optional` **width?**: `number`

Defined in: engine/src/systems/RenderSystem.ts:128

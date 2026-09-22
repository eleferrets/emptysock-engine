[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / RenderSystemOptions

# Interface: RenderSystemOptions

Defined in: [engine/src/systems/RenderSystem.ts:11](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/RenderSystem.ts#L11)

## Properties

### antialias?

> `optional` **antialias?**: `boolean`

Defined in: [engine/src/systems/RenderSystem.ts:15](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/RenderSystem.ts#L15)

***

### backgroundColor?

> `optional` **backgroundColor?**: `number`

Defined in: [engine/src/systems/RenderSystem.ts:14](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/RenderSystem.ts#L14)

***

### gpuTier?

> `optional` **gpuTier?**: `"potato"` \| `"low"` \| `"mid"` \| `"high"` \| `"ultra"`

Defined in: [engine/src/systems/RenderSystem.ts:24](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/RenderSystem.ts#L24)

When provided (and `antialias`/`resolution` are not explicitly set),
caps resolution and disables antialiasing below "mid" tier so weak GPUs
(older mobile, integrated) don't pay full fill-rate cost. See
gpuTierRenderDefaults() in ViewportSystem.ts for the thresholds.

***

### height?

> `optional` **height?**: `number`

Defined in: [engine/src/systems/RenderSystem.ts:13](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/RenderSystem.ts#L13)

***

### layerSystem?

> `optional` **layerSystem?**: [`LayerSystem`](../classes/LayerSystem.md)

Defined in: [engine/src/systems/RenderSystem.ts:17](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/RenderSystem.ts#L17)

***

### resolution?

> `optional` **resolution?**: `number`

Defined in: [engine/src/systems/RenderSystem.ts:16](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/RenderSystem.ts#L16)

***

### width?

> `optional` **width?**: `number`

Defined in: [engine/src/systems/RenderSystem.ts:12](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/RenderSystem.ts#L12)

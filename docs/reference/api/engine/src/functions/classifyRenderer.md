[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / classifyRenderer

# Function: classifyRenderer()

> **classifyRenderer**(`renderer`): `"potato"` \| `"low"` \| `"mid"` \| `"high"` \| `"ultra"`

Defined in: [engine/src/core/GPUTier.ts:30](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/GPUTier.ts#L30)

Classify a raw WebGL renderer string into a GPUTier. Exported so that
HostAdapter implementations can reuse the classification logic.

## Parameters

### renderer

`string`

## Returns

`"potato"` \| `"low"` \| `"mid"` \| `"high"` \| `"ultra"`

[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / classifyRenderer

# Function: classifyRenderer()

> **classifyRenderer**(`renderer`): `"potato"` \| `"low"` \| `"mid"` \| `"high"` \| `"ultra"`

Defined in: [engine/src/core/GPUTier.ts:30](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/GPUTier.ts#L30)

Classify a raw WebGL renderer string into a GPUTier. Exported so that
HostAdapter implementations can reuse the classification logic.

## Parameters

### renderer

`string`

## Returns

`"potato"` \| `"low"` \| `"mid"` \| `"high"` \| `"ultra"`

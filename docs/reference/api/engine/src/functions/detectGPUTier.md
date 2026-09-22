[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / detectGPUTier

# Function: detectGPUTier()

> **detectGPUTier**(`adapter`): `"potato"` \| `"low"` \| `"mid"` \| `"high"` \| `"ultra"`

Defined in: [engine/src/core/GPUTier.ts:22](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/GPUTier.ts#L22)

Detect GPU tier by delegating to the HostAdapter.
The adapter implementation may use document.createElement('canvas') and
WebGL debug renderer info — DOM access belongs in the host layer, not here.

Pass a NullHostAdapter (or omit the adapter) in Node.js / headless contexts;
it returns 'mid' as a safe fallback.

## Parameters

### adapter

`GPUTierAdapter`

## Returns

`"potato"` \| `"low"` \| `"mid"` \| `"high"` \| `"ultra"`

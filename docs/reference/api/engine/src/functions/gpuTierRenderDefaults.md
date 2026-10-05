[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / gpuTierRenderDefaults

# Function: gpuTierRenderDefaults()

> **gpuTierRenderDefaults**(`tier`, `devicePixelRatio?`): `object`

Defined in: engine/src/systems/ViewportSystem.ts:124

Reads GPU-tier-appropriate default RenderSystem init options.
"potato" and "low" tiers disable antialiasing and cap devicePixelRatio at 1
to protect frame time on weak GPUs. "mid" and above keep antialiasing and
use the full device pixel ratio (capped at 2 to bound fill-rate cost on
ultra-high-DPI mobile panels).

## Parameters

### tier

`"potato"` \| `"low"` \| `"mid"` \| `"high"` \| `"ultra"`

### devicePixelRatio?

`number` = `1`

## Returns

`object`

### antialias

> **antialias**: `boolean`

### resolution

> **resolution**: `number`

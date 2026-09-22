[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / TextureLoader

# Type Alias: TextureLoader

> **TextureLoader** = (`path`) => `Promise`\<`Texture`\>

Defined in: [engine/src/systems/RenderPipeline.ts:52](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/RenderPipeline.ts#L52)

Loads (and ideally caches) a texture for a given asset path. Swappable for tests/headless hosts.

## Parameters

### path

`string`

## Returns

`Promise`\<`Texture`\>

[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / TextureLoader

# Type Alias: TextureLoader

> **TextureLoader** = (`path`) => `Promise`\<`Texture`\>

Defined in: [engine/src/systems/RenderPipeline.ts:52](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/RenderPipeline.ts#L52)

Loads (and ideally caches) a texture for a given asset path. Swappable for tests/headless hosts.

## Parameters

### path

`string`

## Returns

`Promise`\<`Texture`\>

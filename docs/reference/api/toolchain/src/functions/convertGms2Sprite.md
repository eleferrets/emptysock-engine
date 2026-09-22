[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [toolchain/src](../README.md) / convertGms2Sprite

# Function: convertGms2Sprite()

> **convertGms2Sprite**(`spriteYyDir`): `Promise`\<[`SpriteAsset`](../interfaces/SpriteAsset.md)\>

Defined in: [toolchain/src/gms2-sprite-import.ts:52](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/toolchain/src/gms2-sprite-import.ts#L52)

Convert a GMS2 sprite directory (containing a .yy file) into a SpriteAsset.
Throws a descriptive Error if the directory or .yy file cannot be read, or if
the JSON is invalid or missing required fields.

## Parameters

### spriteYyDir

`string`

## Returns

`Promise`\<[`SpriteAsset`](../interfaces/SpriteAsset.md)\>

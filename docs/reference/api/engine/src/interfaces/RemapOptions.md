[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / RemapOptions

# Interface: RemapOptions

Defined in: engine/src/RefRemap.ts:18

## Properties

### onMissing?

> `readonly` `optional` **onMissing?**: (`oldId`, `where`) => `void`

Defined in: engine/src/RefRemap.ts:20

Called for a ref whose old id has no entry. Default: `console.warn`.

#### Parameters

##### oldId

`string` \| `number`

##### where

`string`

#### Returns

`void`

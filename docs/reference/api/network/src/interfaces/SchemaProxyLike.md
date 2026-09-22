[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [network/src](../README.md) / SchemaProxyLike

# Interface: SchemaProxyLike\<T\>

Defined in: [network/src/colyseusTypes.ts:26](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/network/src/colyseusTypes.ts#L26)

The `$(instance).listen(field, cb)` shape colyseus.js's schema-callbacks proxy exposes.

## Type Parameters

### T

`T`

## Methods

### listen()

> **listen**\<`K`\>(`field`, `callback`): () => `void`

Defined in: [network/src/colyseusTypes.ts:27](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/network/src/colyseusTypes.ts#L27)

#### Type Parameters

##### K

`K` *extends* `string`

#### Parameters

##### field

`K`

##### callback

(`value`, `previousValue`) => `void`

#### Returns

() => `void`

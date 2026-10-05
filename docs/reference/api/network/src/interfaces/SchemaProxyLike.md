[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [network/src](../README.md) / SchemaProxyLike

# Interface: SchemaProxyLike\<T\>

Defined in: network/src/colyseusTypes.ts:26

The `$(instance).listen(field, cb)` shape colyseus.js's schema-callbacks proxy exposes.

## Type Parameters

### T

`T`

## Methods

### listen()

> **listen**\<`K`\>(`field`, `callback`): () => `void`

Defined in: network/src/colyseusTypes.ts:27

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

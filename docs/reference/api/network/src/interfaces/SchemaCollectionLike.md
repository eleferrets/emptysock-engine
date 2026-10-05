[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [network/src](../README.md) / SchemaCollectionLike

# Interface: SchemaCollectionLike\<T\>

Defined in: network/src/colyseusTypes.ts:34

The `$(collection).onAdd/.onRemove` shape colyseus.js exposes for a `MapSchema`/`ArraySchema` field.

## Type Parameters

### T

`T`

## Methods

### onAdd()

> **onAdd**(`callback`): () => `void`

Defined in: network/src/colyseusTypes.ts:35

#### Parameters

##### callback

(`item`, `key`) => `void`

#### Returns

() => `void`

***

### onRemove()

> **onRemove**(`callback`): () => `void`

Defined in: network/src/colyseusTypes.ts:36

#### Parameters

##### callback

(`item`, `key`) => `void`

#### Returns

() => `void`

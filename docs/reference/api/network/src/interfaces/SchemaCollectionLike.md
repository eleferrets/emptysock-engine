[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [network/src](../README.md) / SchemaCollectionLike

# Interface: SchemaCollectionLike\<T\>

Defined in: [network/src/colyseusTypes.ts:34](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/network/src/colyseusTypes.ts#L34)

The `$(collection).onAdd/.onRemove` shape colyseus.js exposes for a `MapSchema`/`ArraySchema` field.

## Type Parameters

### T

`T`

## Methods

### onAdd()

> **onAdd**(`callback`): () => `void`

Defined in: [network/src/colyseusTypes.ts:35](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/network/src/colyseusTypes.ts#L35)

#### Parameters

##### callback

(`item`, `key`) => `void`

#### Returns

() => `void`

***

### onRemove()

> **onRemove**(`callback`): () => `void`

Defined in: [network/src/colyseusTypes.ts:36](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/network/src/colyseusTypes.ts#L36)

#### Parameters

##### callback

(`item`, `key`) => `void`

#### Returns

() => `void`

[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [network/src](../README.md) / StateCallbacksProxy

# Type Alias: StateCallbacksProxy\<T\>

> **StateCallbacksProxy**\<`T`\> = [`SchemaProxyLike`](../interfaces/SchemaProxyLike.md)\<`T`\> & [`SchemaCollectionLike`](../interfaces/SchemaCollectionLike.md)\<`T`\> & `object`

Defined in: [network/src/colyseusTypes.ts:47](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/network/src/colyseusTypes.ts#L47)

What `getStateCallbacks(room)` returns: calling it on a `Schema` instance
gives you `SchemaProxyLike`; calling it on a `MapSchema`/`ArraySchema`
field gives you `SchemaCollectionLike`. colyseus.js's real proxy supports
both shapes on the same object (nested property access narrows which one
applies) — we model that here as an intersection plus index access for
"get the collection at this key".

## Type Parameters

### T

`T`

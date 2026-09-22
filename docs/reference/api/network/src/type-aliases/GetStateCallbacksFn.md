[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [network/src](../README.md) / GetStateCallbacksFn

# Type Alias: GetStateCallbacksFn

> **GetStateCallbacksFn** = (`room`) => [`CallbackProxyFn`](CallbackProxyFn.md)

Defined in: [network/src/colyseusTypes.ts:61](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/network/src/colyseusTypes.ts#L61)

colyseus.js's real `getStateCallbacks(room)` — called once per room with
the `Room` itself, returning the `$` proxy function you then apply to
`room.state`, a nested `Schema` instance, or a `MapSchema`/`ArraySchema`
collection (`const $ = getStateCallbacks(room); $(room.state).players.onAdd(...)`).

## Parameters

### room

[`RoomLike`](../interfaces/RoomLike.md)

## Returns

[`CallbackProxyFn`](CallbackProxyFn.md)

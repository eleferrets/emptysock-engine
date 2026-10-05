[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / defineScene

# Function: defineScene()

> **defineScene**\<`T`\>(`definition`): `T`

Defined in: engine/src/Game.ts:287

Type-checked scene definition constructor. Prefer this over a bare object
literal passed straight to `Game.loadScene` when you want the compiler to
catch an accidentally-`async onUpdate` (see `RejectAsyncOnUpdate`). JS
callers get no compile-time check either way — see `warnIfPromiseReturned`
for the runtime fallback `Game.update()` always performs regardless of how
the scene was defined.

## Type Parameters

### T

`T` *extends* [`SceneDefinition`](../interfaces/SceneDefinition.md)

## Parameters

### definition

`T` & `RejectAsyncOnUpdate`\<`T`\>

## Returns

`T`

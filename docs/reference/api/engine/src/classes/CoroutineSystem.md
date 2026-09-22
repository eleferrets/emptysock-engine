[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / CoroutineSystem

# Class: CoroutineSystem

Defined in: [engine/src/systems/CoroutineSystem.ts:29](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/CoroutineSystem.ts#L29)

## Constructors

### Constructor

> **new CoroutineSystem**(): `CoroutineSystem`

#### Returns

`CoroutineSystem`

## Properties

### onError

> **onError**: ((`id`, `error`) => `void`) \| `null` = `null`

Defined in: [engine/src/systems/CoroutineSystem.ts:37](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/CoroutineSystem.ts#L37)

Called when a coroutine throws. Receives the coroutine id and the error.
The coroutine is stopped before this is called.
When unset, errors are logged to `console.error`.

## Methods

### destroy()

> **destroy**(): `void`

Defined in: [engine/src/systems/CoroutineSystem.ts:95](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/CoroutineSystem.ts#L95)

Cancel all running coroutines. The system remains usable; new coroutines can be started after this call.

#### Returns

`void`

***

### start()

> **start**(`id`, `gen`): `void`

Defined in: [engine/src/systems/CoroutineSystem.ts:39](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/CoroutineSystem.ts#L39)

#### Parameters

##### id

`string`

##### gen

[`CoroutineGen`](../type-aliases/CoroutineGen.md)

#### Returns

`void`

***

### stop()

> **stop**(`id`): `void`

Defined in: [engine/src/systems/CoroutineSystem.ts:51](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/CoroutineSystem.ts#L51)

#### Parameters

##### id

`string`

#### Returns

`void`

***

### stopAll()

> **stopAll**(): `void`

Defined in: [engine/src/systems/CoroutineSystem.ts:83](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/CoroutineSystem.ts#L83)

Stop all running coroutines by returning from each generator, then clear
the map. The system remains usable; new coroutines can be started after
this call.

#### Returns

`void`

***

### update()

> **update**(`deltaTime`): `void`

Defined in: [engine/src/systems/CoroutineSystem.ts:55](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/CoroutineSystem.ts#L55)

#### Parameters

##### deltaTime

`number`

#### Returns

`void`

[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / Actor

# Abstract Class: Actor

Defined in: [engine/src/core/Actor.ts:16](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Actor.ts#L16)

## Extended by

- [`NetworkActor`](NetworkActor.md)

## Constructors

### Constructor

> **new Actor**(`id`): `Actor`

Defined in: [engine/src/core/Actor.ts:21](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Actor.ts#L21)

#### Parameters

##### id

`string`

#### Returns

`Actor`

## Properties

### id

> `readonly` **id**: `string`

Defined in: [engine/src/core/Actor.ts:17](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Actor.ts#L17)

## Accessors

### isRunning

#### Get Signature

> **get** **isRunning**(): `boolean`

Defined in: [engine/src/core/Actor.ts:60](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Actor.ts#L60)

##### Returns

`boolean`

## Methods

### destroy()

> **destroy**(): `void`

Defined in: [engine/src/core/Actor.ts:58](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Actor.ts#L58)

Override to clean up listeners and resources.

#### Returns

`void`

***

### flush()

> **flush**(): `void`

Defined in: [engine/src/core/Actor.ts:37](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Actor.ts#L37)

Drain the mailbox and dispatch each message. Called by ActorSystem each frame.

#### Returns

`void`

***

### onStart()

> `protected` **onStart**(): `void`

Defined in: [engine/src/core/Actor.ts:76](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Actor.ts#L76)

#### Returns

`void`

***

### onStop()

> `protected` **onStop**(): `void`

Defined in: [engine/src/core/Actor.ts:77](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Actor.ts#L77)

#### Returns

`void`

***

### receive()

> `abstract` **receive**(`msg`): `void`

Defined in: [engine/src/core/Actor.ts:52](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Actor.ts#L52)

Override to handle incoming messages.

#### Parameters

##### msg

[`Message`](../interfaces/Message.md)

#### Returns

`void`

***

### send()

> **send**(`msg`): `void`

Defined in: [engine/src/core/Actor.ts:26](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Actor.ts#L26)

Enqueue a message in this actor's mailbox. Drops the message with a warning if the inbox exceeds the limit.

#### Parameters

##### msg

[`Message`](../interfaces/Message.md)

#### Returns

`void`

***

### start()

> **start**(): `void`

Defined in: [engine/src/core/Actor.ts:65](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Actor.ts#L65)

Called by ActorSystem.register().

#### Returns

`void`

***

### stop()

> **stop**(): `void`

Defined in: [engine/src/core/Actor.ts:71](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Actor.ts#L71)

Called by ActorSystem.unregister().

#### Returns

`void`

***

### update()

> **update**(`_dt`): `void`

Defined in: [engine/src/core/Actor.ts:55](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Actor.ts#L55)

Override to add per-frame logic (dt in seconds).

#### Parameters

##### \_dt

`number`

#### Returns

`void`

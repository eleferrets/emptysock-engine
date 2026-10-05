[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / Actor

# Abstract Class: Actor

Defined in: engine/src/Actor.ts:19

## Constructors

### Constructor

> **new Actor**(`id`): `Actor`

Defined in: engine/src/Actor.ts:24

#### Parameters

##### id

`string`

#### Returns

`Actor`

## Properties

### id

> `readonly` **id**: `string`

Defined in: engine/src/Actor.ts:20

## Accessors

### inboxSize

#### Get Signature

> **get** **inboxSize**(): `number`

Defined in: engine/src/Actor.ts:68

Number of messages currently queued, not yet drained by `flush()`. Read by `QueryChannel`'s `actorInboxSize` query.

##### Returns

`number`

***

### isRunning

#### Get Signature

> **get** **isRunning**(): `boolean`

Defined in: engine/src/Actor.ts:63

##### Returns

`boolean`

## Methods

### destroy()

> **destroy**(): `void`

Defined in: engine/src/Actor.ts:61

Override to clean up listeners and resources.

#### Returns

`void`

***

### flush()

> **flush**(): `void`

Defined in: engine/src/Actor.ts:40

Drain the mailbox and dispatch each message. Called by ActorSystem each frame.

#### Returns

`void`

***

### onStart()

> `protected` **onStart**(): `void`

Defined in: engine/src/Actor.ts:84

#### Returns

`void`

***

### onStop()

> `protected` **onStop**(): `void`

Defined in: engine/src/Actor.ts:85

#### Returns

`void`

***

### receive()

> `abstract` **receive**(`msg`): `void`

Defined in: engine/src/Actor.ts:55

Override to handle incoming messages.

#### Parameters

##### msg

[`Message`](../interfaces/Message.md)

#### Returns

`void`

***

### send()

> **send**(`msg`): `void`

Defined in: engine/src/Actor.ts:29

Enqueue a message in this actor's mailbox. Drops the message with a warning if the inbox exceeds the limit.

#### Parameters

##### msg

[`Message`](../interfaces/Message.md)

#### Returns

`void`

***

### start()

> **start**(): `void`

Defined in: engine/src/Actor.ts:73

Called by ActorSystem.register().

#### Returns

`void`

***

### stop()

> **stop**(): `void`

Defined in: engine/src/Actor.ts:79

Called by ActorSystem.unregister().

#### Returns

`void`

***

### update()

> **update**(`_dt`): `void`

Defined in: engine/src/Actor.ts:58

Override to add per-frame logic (dt in seconds).

#### Parameters

##### \_dt

`number`

#### Returns

`void`

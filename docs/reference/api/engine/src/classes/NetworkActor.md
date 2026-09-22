[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / NetworkActor

# Abstract Class: NetworkActor

Defined in: [engine/src/core/NetworkActor.ts:12](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/NetworkActor.ts#L12)

Opt-in base class for actors that participate in real-time networking.
Attach a Transport (WebSocket, WebRTC, etc.) before calling start().

Messages arriving from the network are forwarded into the local mailbox
exactly as if they were sent locally — so receive() handles both cases.

## Extends

- [`Actor`](Actor.md)

## Constructors

### Constructor

> **new NetworkActor**(`id`): `NetworkActor`

Defined in: [engine/src/core/Actor.ts:21](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Actor.ts#L21)

#### Parameters

##### id

`string`

#### Returns

`NetworkActor`

#### Inherited from

[`Actor`](Actor.md).[`constructor`](Actor.md#constructor)

## Properties

### \_transport

> `protected` **\_transport**: [`Transport`](../interfaces/Transport.md) \| `null` = `null`

Defined in: [engine/src/core/NetworkActor.ts:13](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/NetworkActor.ts#L13)

***

### id

> `readonly` **id**: `string`

Defined in: [engine/src/core/Actor.ts:17](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Actor.ts#L17)

#### Inherited from

[`Actor`](Actor.md).[`id`](Actor.md#id)

## Accessors

### isRunning

#### Get Signature

> **get** **isRunning**(): `boolean`

Defined in: [engine/src/core/Actor.ts:60](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Actor.ts#L60)

##### Returns

`boolean`

#### Inherited from

[`Actor`](Actor.md).[`isRunning`](Actor.md#isrunning)

## Methods

### destroy()

> **destroy**(): `void`

Defined in: [engine/src/core/NetworkActor.ts:33](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/NetworkActor.ts#L33)

Override to clean up listeners and resources.

#### Returns

`void`

#### Overrides

[`Actor`](Actor.md).[`destroy`](Actor.md#destroy)

***

### flush()

> **flush**(): `void`

Defined in: [engine/src/core/Actor.ts:37](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Actor.ts#L37)

Drain the mailbox and dispatch each message. Called by ActorSystem each frame.

#### Returns

`void`

#### Inherited from

[`Actor`](Actor.md).[`flush`](Actor.md#flush)

***

### onStart()

> `protected` **onStart**(): `void`

Defined in: [engine/src/core/Actor.ts:76](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Actor.ts#L76)

#### Returns

`void`

#### Inherited from

[`Actor`](Actor.md).[`onStart`](Actor.md#onstart)

***

### onStop()

> `protected` **onStop**(): `void`

Defined in: [engine/src/core/Actor.ts:77](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Actor.ts#L77)

#### Returns

`void`

#### Inherited from

[`Actor`](Actor.md).[`onStop`](Actor.md#onstop)

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

#### Inherited from

[`Actor`](Actor.md).[`receive`](Actor.md#receive)

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

#### Inherited from

[`Actor`](Actor.md).[`send`](Actor.md#send)

***

### sendRemote()

> `protected` **sendRemote**(`targetActorId`, `msg`): `void`

Defined in: [engine/src/core/NetworkActor.ts:25](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/NetworkActor.ts#L25)

Send a message to a remote peer's actor.

#### Parameters

##### targetActorId

`string`

##### msg

[`Message`](../interfaces/Message.md)

#### Returns

`void`

***

### setTransport()

> **setTransport**(`transport`): `void`

Defined in: [engine/src/core/NetworkActor.ts:15](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/NetworkActor.ts#L15)

#### Parameters

##### transport

[`Transport`](../interfaces/Transport.md)

#### Returns

`void`

***

### start()

> **start**(): `void`

Defined in: [engine/src/core/Actor.ts:65](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Actor.ts#L65)

Called by ActorSystem.register().

#### Returns

`void`

#### Inherited from

[`Actor`](Actor.md).[`start`](Actor.md#start)

***

### stop()

> **stop**(): `void`

Defined in: [engine/src/core/Actor.ts:71](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Actor.ts#L71)

Called by ActorSystem.unregister().

#### Returns

`void`

#### Inherited from

[`Actor`](Actor.md).[`stop`](Actor.md#stop)

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

#### Inherited from

[`Actor`](Actor.md).[`update`](Actor.md#update)

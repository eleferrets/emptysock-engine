[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / ActorSystem

# Class: ActorSystem

Defined in: engine/src/ActorSystem.ts:12

Manages a registry of Actors. Wire this into your game loop:

  const actors = new ActorSystem();
  actors.register(myActor);
  // in update:
  actors.update(dt);

## Constructors

### Constructor

> **new ActorSystem**(): `ActorSystem`

#### Returns

`ActorSystem`

## Accessors

### size

#### Get Signature

> **get** **size**(): `number`

Defined in: engine/src/ActorSystem.ts:72

##### Returns

`number`

## Methods

### broadcast()

> **broadcast**(`msg`): `void`

Defined in: engine/src/ActorSystem.ts:48

Broadcast a message to every registered actor.

#### Parameters

##### msg

[`Message`](../interfaces/Message.md)

#### Returns

`void`

***

### destroy()

> **destroy**(): `void`

Defined in: engine/src/ActorSystem.ts:64

#### Returns

`void`

***

### get()

> **get**(`id`): [`Actor`](Actor.md) \| `undefined`

Defined in: engine/src/ActorSystem.ts:33

#### Parameters

##### id

`string`

#### Returns

[`Actor`](Actor.md) \| `undefined`

***

### getAll()

> **getAll**(): [`Actor`](Actor.md)[]

Defined in: engine/src/ActorSystem.ts:38

Returns every registered actor in registration order.

#### Returns

[`Actor`](Actor.md)[]

***

### register()

> **register**(`actor`): `void`

Defined in: engine/src/ActorSystem.ts:15

#### Parameters

##### actor

[`Actor`](Actor.md)

#### Returns

`void`

***

### send()

> **send**(`actorId`, `msg`): `void`

Defined in: engine/src/ActorSystem.ts:43

Send a message to a specific actor by id. No-op if the id is unknown.

#### Parameters

##### actorId

`string`

##### msg

[`Message`](../interfaces/Message.md)

#### Returns

`void`

***

### unregister()

> **unregister**(`id`): `void`

Defined in: engine/src/ActorSystem.ts:25

#### Parameters

##### id

`string`

#### Returns

`void`

***

### update()

> **update**(`dt`): `void`

Defined in: engine/src/ActorSystem.ts:55

Flush mailboxes then call update on every actor. Call once per frame.

#### Parameters

##### dt

`number`

#### Returns

`void`

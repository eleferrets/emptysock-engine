[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / RoomStateCache

# Class: RoomStateCache

Defined in: engine/src/RoomStateCache.ts:9

Game-owned store of the entity state of persistent rooms (a scene definition
with a `persistentKey`), keyed by that key. `Game.loadScene` fills it when a
persistent room is left and `SceneLifecycle.restoreRoom()` drains it when the
room is entered again, so the room comes back as it was left.

## Constructors

### Constructor

> **new RoomStateCache**(): `RoomStateCache`

#### Returns

`RoomStateCache`

## Methods

### clear()

> **clear**(`key?`): `void`

Defined in: engine/src/RoomStateCache.ts:33

Forget `key`, or every room when omitted.

#### Parameters

##### key?

`string`

#### Returns

`void`

***

### has()

> **has**(`key`): `boolean`

Defined in: engine/src/RoomStateCache.ts:16

#### Parameters

##### key

`string`

#### Returns

`boolean`

***

### keys()

> **keys**(): `string`[]

Defined in: engine/src/RoomStateCache.ts:39

Keys currently cached.

#### Returns

`string`[]

***

### peek()

> **peek**(`key`): [`SceneSnapshot`](../interfaces/SceneSnapshot.md) \| `undefined`

Defined in: engine/src/RoomStateCache.ts:21

The snapshot for `key` without removing it.

#### Parameters

##### key

`string`

#### Returns

[`SceneSnapshot`](../interfaces/SceneSnapshot.md) \| `undefined`

***

### store()

> **store**(`key`, `snapshot`): `void`

Defined in: engine/src/RoomStateCache.ts:12

#### Parameters

##### key

`string`

##### snapshot

[`SceneSnapshot`](../interfaces/SceneSnapshot.md)

#### Returns

`void`

***

### take()

> **take**(`key`): [`SceneSnapshot`](../interfaces/SceneSnapshot.md) \| `undefined`

Defined in: engine/src/RoomStateCache.ts:26

Remove and return the snapshot for `key`.

#### Parameters

##### key

`string`

#### Returns

[`SceneSnapshot`](../interfaces/SceneSnapshot.md) \| `undefined`

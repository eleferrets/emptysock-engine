[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / MemoryStorageAdapter

# Class: MemoryStorageAdapter

Defined in: engine/src/systems/StorageAdapter.ts:42

Default adapter: an in-process `Map`. Nothing persists across process
restarts — this is intentional. It exists so `SaveSystem` has a working,
environment-boundary-safe default everywhere (Node/Vitest included), not
so a real game ships it as its save backend.

## Implements

- [`StorageAdapter`](../interfaces/StorageAdapter.md)

## Constructors

### Constructor

> **new MemoryStorageAdapter**(): `MemoryStorageAdapter`

#### Returns

`MemoryStorageAdapter`

## Methods

### delete()

> **delete**(`key`): `Promise`\<`void`\>

Defined in: engine/src/systems/StorageAdapter.ts:54

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`StorageAdapter`](../interfaces/StorageAdapter.md).[`delete`](../interfaces/StorageAdapter.md#delete)

***

### get()

> **get**(`key`): `Promise`\<`string` \| `null`\>

Defined in: engine/src/systems/StorageAdapter.ts:45

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`string` \| `null`\>

#### Implementation of

[`StorageAdapter`](../interfaces/StorageAdapter.md).[`get`](../interfaces/StorageAdapter.md#get)

***

### listKeys()

> **listKeys**(`prefix`): `Promise`\<`string`[]\>

Defined in: engine/src/systems/StorageAdapter.ts:59

All keys currently stored under `prefix`.

#### Parameters

##### prefix

`string`

#### Returns

`Promise`\<`string`[]\>

#### Implementation of

[`StorageAdapter`](../interfaces/StorageAdapter.md).[`listKeys`](../interfaces/StorageAdapter.md#listkeys)

***

### set()

> **set**(`key`, `value`): `Promise`\<`void`\>

Defined in: engine/src/systems/StorageAdapter.ts:49

#### Parameters

##### key

`string`

##### value

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`StorageAdapter`](../interfaces/StorageAdapter.md).[`set`](../interfaces/StorageAdapter.md#set)

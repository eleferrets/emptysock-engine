[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / EntityExtra

# Interface: EntityExtra\<T\>

Defined in: engine/src/SceneTransfer.ts:29

State one entity keeps outside its components (a per-`(World, eid)` side table).

## Type Parameters

### T

`T` = `unknown`

## Properties

### name

> `readonly` **name**: `string`

Defined in: engine/src/SceneTransfer.ts:30

***

### version?

> `readonly` `optional` **version?**: `number`

Defined in: engine/src/SceneTransfer.ts:36

Schema version of the data `export` produces (default `1`). Stamped into
saved room caches; a save written under another version runs `migrate`
on load, or the extra's data for that entity is dropped with a warning.

## Methods

### clear()

> **clear**(`world`, `eid`): `void`

Defined in: engine/src/SceneTransfer.ts:47

Drop the old `(world, eid)` entry after export (pooled-id hygiene).

#### Parameters

##### world

`World`\<\{ \}\>

##### eid

`number`

#### Returns

`void`

***

### export()

> **export**(`entity`): `T` \| `undefined`

Defined in: engine/src/SceneTransfer.ts:43

Copy the entity's state, or `undefined` when it has none.

#### Parameters

##### entity

[`Entity`](../classes/Entity.md)

#### Returns

`T` \| `undefined`

***

### import()

> **import**(`entity`, `data`, `ctx`): `void`

Defined in: engine/src/SceneTransfer.ts:45

Re-apply `data` to the respawned `entity`. Runs after every entity of the snapshot exists.

#### Parameters

##### entity

[`Entity`](../classes/Entity.md)

##### data

`T`

##### ctx

[`TransferContext`](TransferContext.md)

#### Returns

`void`

***

### migrate()?

> `optional` **migrate**(`data`, `fromVersion`): `unknown`

Defined in: engine/src/SceneTransfer.ts:41

Brings `data` saved under `fromVersion` up to the current `version`.
Only JSON-safe extras are ever saved, so `data` is plain JSON.

#### Parameters

##### data

`unknown`

##### fromVersion

`number`

#### Returns

`unknown`

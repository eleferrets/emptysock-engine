[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / CGGallery

# Class: CGGallery

Defined in: engine/src/systems/CGGallery.ts:24

the release notes Track 3 — a real, confirmed-live IDE feature, not dead
code. Persists unlock flags through a `StorageAdapter`, the same
interface `InputManager.saveBindings()`/`loadBindings()` already use for
a `Game`-level settings blob, not `SaveSystem` — a CG gallery's unlock
flags are exactly the same shape of problem `InputManager`'s bindings
were: a small, scene-independent blob, not per-entity component data, so
`SaveSystem`'s `Scene`/`ComponentDef`-bound save/load API (it serializes
a `Scene`'s live entities, not an arbitrary settings object) is the wrong
shape for it.

## Constructors

### Constructor

> **new CGGallery**(`opts`): `CGGallery`

Defined in: engine/src/systems/CGGallery.ts:28

#### Parameters

##### opts

[`CGGalleryOptions`](../interfaces/CGGalleryOptions.md)

#### Returns

`CGGallery`

## Accessors

### entries

#### Get Signature

> **get** **entries**(): readonly [`CGEntry`](../interfaces/CGEntry.md)[]

Defined in: engine/src/systems/CGGallery.ts:74

##### Returns

readonly [`CGEntry`](../interfaces/CGEntry.md)[]

***

### totalCount

#### Get Signature

> **get** **totalCount**(): `number`

Defined in: engine/src/systems/CGGallery.ts:82

##### Returns

`number`

***

### unlockedCount

#### Get Signature

> **get** **unlockedCount**(): `number`

Defined in: engine/src/systems/CGGallery.ts:86

##### Returns

`number`

***

### unlockedEntries

#### Get Signature

> **get** **unlockedEntries**(): [`CGEntry`](../interfaces/CGEntry.md)[]

Defined in: engine/src/systems/CGGallery.ts:78

##### Returns

[`CGEntry`](../interfaces/CGEntry.md)[]

## Methods

### isUnlocked()

> **isUnlocked**(`id`): `boolean`

Defined in: engine/src/systems/CGGallery.ts:70

#### Parameters

##### id

`string`

#### Returns

`boolean`

***

### load()

> **load**(`adapter`, `key?`): `Promise`\<`void`\>

Defined in: engine/src/systems/CGGallery.ts:33

Load previously `save()`-persisted unlock flags. Leaves the gallery untouched if nothing was stored under `key` or it couldn't be parsed.

#### Parameters

##### adapter

[`StorageAdapter`](../interfaces/StorageAdapter.md)

##### key?

`string` = `"emptysock_cg_gallery"`

#### Returns

`Promise`\<`void`\>

***

### unlock()

> **unlock**(`adapter`, `id`, `key?`): `Promise`\<`void`\>

Defined in: engine/src/systems/CGGallery.ts:60

Mark a CG as unlocked and persist immediately.

#### Parameters

##### adapter

[`StorageAdapter`](../interfaces/StorageAdapter.md)

##### id

`string`

##### key?

`string` = `"emptysock_cg_gallery"`

#### Returns

`Promise`\<`void`\>

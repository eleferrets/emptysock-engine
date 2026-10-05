[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / SaveSystemOptions

# Interface: SaveSystemOptions

Defined in: engine/src/systems/SaveSystem.ts:127

## Properties

### adapter?

> `readonly` `optional` **adapter?**: [`StorageAdapter`](StorageAdapter.md)

Defined in: engine/src/systems/SaveSystem.ts:134

Storage backend. Defaults to an in-memory adapter (safe under Node/
Vitest and the headless testing harness); a real game supplies an
IndexedDB- or Tauri-fs-backed adapter built outside the engine package
— see `StorageAdapter.ts`'s doc comment for why.

***

### carried?

> `readonly` `optional` **carried?**: [`CarriedSlot`](CarriedSlot.md)

Defined in: engine/src/systems/SaveSystem.ts:152

In-flight carry to save and restore, with the same JSON-safe rule as `rooms`.

***

### engineVersion?

> `readonly` `optional` **engineVersion?**: `string`

Defined in: engine/src/systems/SaveSystem.ts:166

Stamped into `meta` so a later build can tell what wrote a save.

***

### extras?

> `readonly` `optional` **extras?**: readonly [`EntityExtra`](EntityExtra.md)\<`unknown`\>[]

Defined in: engine/src/systems/SaveSystem.ts:157

The `EntityExtra`s whose data is saved with `rooms`/`carried` (the same
ones the scene's transfer policies use). Extras not listed are dropped.

***

### gameVersion?

> `readonly` `optional` **gameVersion?**: `string`

Defined in: engine/src/systems/SaveSystem.ts:167

***

### globals?

> `readonly` `optional` **globals?**: [`GlobalStore`](../classes/GlobalStore.md)

Defined in: engine/src/systems/SaveSystem.ts:143

Game services whose state is saved beside the entities: omit either to leave it out.

***

### keyPrefix?

> `readonly` `optional` **keyPrefix?**: `string`

Defined in: engine/src/systems/SaveSystem.ts:136

Prefix under which slot keys are stored. Defaults to `"emptysock_save_"`.

***

### relations?

> `readonly` `optional` **relations?**: readonly [`RelationDef`](RelationDef.md)[]

Defined in: engine/src/systems/SaveSystem.ts:141

Relations to persist besides the built-in `ChildOf`. Edges of relations
not listed here are not saved.

***

### room?

> `readonly` `optional` **room?**: () => `string` \| `undefined`

Defined in: engine/src/systems/SaveSystem.ts:164

Supplies the current room/scene key stored in the save (see `SaveHeader.room`).

#### Returns

`string` \| `undefined`

***

### rooms?

> `readonly` `optional` **rooms?**: [`RoomStateCache`](../classes/RoomStateCache.md)

Defined in: engine/src/systems/SaveSystem.ts:150

Persistent-room cache (`Game.roomCache`) to save and restore. Only the
JSON-safe parts are written: components whose data, and extras whose
exported value, are not plain JSON are dropped with a warning.

***

### transferComponents?

> `readonly` `optional` **transferComponents?**: readonly [`ComponentDef`](ComponentDef.md)\<[`SerializableRecord`](../type-aliases/SerializableRecord.md)\>[]

Defined in: engine/src/systems/SaveSystem.ts:162

Component defs of entities in `rooms`/`carried` beyond the save-aware
ones. Saved components with no known def are dropped with a warning.

***

### variables?

> `readonly` `optional` **variables?**: [`VariableStore`](../classes/VariableStore.md)

Defined in: engine/src/systems/SaveSystem.ts:144

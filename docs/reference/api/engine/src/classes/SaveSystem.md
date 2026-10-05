[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / SaveSystem

# Class: SaveSystem

Defined in: engine/src/systems/SaveSystem.ts:195

the engine design notes/§19.3 — generic save/load for any ECS-core component
built on the `Serializable` constraint. No per-component save/load code
is required for the common case: `SaveSystem` reads every configured
component's fields straight off the entity via the name-keyed component
lookup already in `Entity`/`ComponentRegistry`.

A `SaveSystem` is bound to one `Scene` and one explicit list of
"save-aware" `ComponentDef`s at construction. The explicit list (rather
than some global "every component ever defined" registry) mirrors
`scene.each(...)`'s own design — Scene/ComponentRegistry deliberately
don't track a global list of every `ComponentDef` that has ever existed,
only per-world, per-name storage — and keeps `SaveSystem` from silently
saving components a game never intended to persist (e.g. purely-visual
runtime state).

## Constructors

### Constructor

> **new SaveSystem**(`scene`, `components`, `options?`): `SaveSystem`

Defined in: engine/src/systems/SaveSystem.ts:204

#### Parameters

##### scene

[`Scene`](Scene.md)

##### components

readonly [`ComponentDef`](../interfaces/ComponentDef.md)\<[`SerializableRecord`](../type-aliases/SerializableRecord.md)\>[]

##### options?

[`SaveSystemOptions`](../interfaces/SaveSystemOptions.md) = `{}`

#### Returns

`SaveSystem`

## Methods

### deleteSave()

> **deleteSave**(`slotId`): `Promise`\<`void`\>

Defined in: engine/src/systems/SaveSystem.ts:253

Delete a save slot. No-op if it doesn't exist.

#### Parameters

##### slotId

`string`

#### Returns

`Promise`\<`void`\>

***

### hasSave()

> **hasSave**(`slotId`): `Promise`\<`boolean`\>

Defined in: engine/src/systems/SaveSystem.ts:242

`true` if a save exists under `slotId`.

#### Parameters

##### slotId

`string`

#### Returns

`Promise`\<`boolean`\>

***

### listSlots()

> **listSlots**(): `Promise`\<`string`[]\>

Defined in: engine/src/systems/SaveSystem.ts:247

All slot ids currently saved.

#### Returns

`Promise`\<`string`[]\>

***

### load()

> **load**(`slotId`, `options?`): `Promise`\<`boolean`\>

Defined in: engine/src/systems/SaveSystem.ts:267

Load `slotId` into this `SaveSystem`'s scene, spawning one fresh entity
per saved entity and re-populating its components by name. A
version-mismatched component either runs its registered `migrate()`
hook, or — if none is registered — logs a warning and drops just that
component's data. Neither case throws or aborts the rest of the load;
a corrupt/outdated single component never corrupts the whole save.

Returns `false` (and loads nothing) if the slot doesn't exist.

#### Parameters

##### slotId

`string`

##### options?

[`LoadOptions`](../interfaces/LoadOptions.md) = `{}`

#### Returns

`Promise`\<`boolean`\>

***

### peek()

> **peek**(`slotId`): `Promise`\<[`SaveHeader`](../interfaces/SaveHeader.md) \| `null`\>

Defined in: engine/src/systems/SaveSystem.ts:321

Header of `slotId` (version, provenance, room) without loading it; `null` if absent or unreadable. Throws `SaveFormatError` for a newer format.

#### Parameters

##### slotId

`string`

#### Returns

`Promise`\<[`SaveHeader`](../interfaces/SaveHeader.md) \| `null`\>

***

### registerMigration()

> **registerMigration**(`componentName`, `migrate`): `void`

Defined in: engine/src/systems/SaveSystem.ts:228

Register a migration for `componentName`, run on load when a saved
instance's stamped version doesn't match the currently-registered
def's version. Only one migration per component name is kept — the
latest registration wins — since it is expected to migrate from
whatever old version is found straight to the current one in one step.

#### Parameters

##### componentName

`string`

##### migrate

[`MigrateFn`](../type-aliases/MigrateFn.md)

#### Returns

`void`

***

### save()

> **save**(`slotId`): `Promise`\<`void`\>

Defined in: engine/src/systems/SaveSystem.ts:236

Snapshot every live entity's save-aware components and persist them
under `slotId`.

#### Parameters

##### slotId

`string`

#### Returns

`Promise`\<`void`\>

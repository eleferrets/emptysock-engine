[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / SaveSystem

# Class: SaveSystem\<TSlot\>

Defined in: [engine/src/systems/SaveSystem.ts:49](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/SaveSystem.ts#L49)

Generic key-value persistence for save slots, backed by `localStorage`.

`SaveSystem` itself only knows how to store and retrieve an opaque JSON
object per slot under a prefixed key, and validate that a loaded slot
matches a schema — it has no opinion on what a "save slot" contains.
The *shape* of a slot is supplied as a Zod schema:

- Construct with no schema to get the default `GameSaveSlot` shape
  (`{ scene, data, timestamp, playtime }`), matching a typical
  `startScene`-driven game.
- Construct with `new SaveSystem(prefix, mySchema)` to store any other
  slot shape your game needs (e.g. per-character saves, a different set
  of bookkeeping fields, no `scene` field at all). `mySchema` must
  describe the full slot including an `id: string` field — `save()`
  fills `id` in from the slot name automatically.

## Type Parameters

### TSlot

`TSlot` *extends* `object` = [`GameSaveSlot`](../interfaces/GameSaveSlot.md)

## Constructors

### Constructor

> **new SaveSystem**\<`TSlot`\>(`prefix?`, `schema?`): `SaveSystem`\<`TSlot`\>

Defined in: [engine/src/systems/SaveSystem.ts:54](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/SaveSystem.ts#L54)

#### Parameters

##### prefix?

`string` = `STORAGE_PREFIX`

##### schema?

`ZodType`\<`TSlot`, `ZodTypeDef`, `TSlot`\>

#### Returns

`SaveSystem`\<`TSlot`\>

## Methods

### delete()

> **delete**(`slotId`): `void`

Defined in: [engine/src/systems/SaveSystem.ts:143](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/SaveSystem.ts#L143)

#### Parameters

##### slotId

`string`

#### Returns

`void`

***

### listSlots()

> **listSlots**(): `TSlot`[]

Defined in: [engine/src/systems/SaveSystem.ts:121](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/SaveSystem.ts#L121)

#### Returns

`TSlot`[]

***

### load()

> **load**(`slotId`): `TSlot` \| `null`

Defined in: [engine/src/systems/SaveSystem.ts:109](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/SaveSystem.ts#L109)

#### Parameters

##### slotId

`string`

#### Returns

`TSlot` \| `null`

***

### save()

> **save**(`slotId`, `entry`): `void`

Defined in: [engine/src/systems/SaveSystem.ts:72](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/SaveSystem.ts#L72)

Persist a save slot.

With the default schema, `timestamp` defaults to `Date.now()` and
`playtime` defaults to `0` when omitted, so a minimal call only needs
`scene` and `data`. With a custom schema, `entry` must supply every
field the schema requires except `id` (which comes from `slotId`).

If the assembled slot does not validate against the schema, the save
is rejected and a warning is logged — nothing is written to storage.

#### Parameters

##### slotId

`string`

##### entry

`TSlot` *extends* [`GameSaveSlot`](../interfaces/GameSaveSlot.md) ? `object` : `Omit`\<`TSlot`, `"id"`\>

#### Returns

`void`

***

### update()

> **update**(`_dt`): `void`

Defined in: [engine/src/systems/SaveSystem.ts:151](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/SaveSystem.ts#L151)

#### Parameters

##### \_dt

`number`

#### Returns

`void`

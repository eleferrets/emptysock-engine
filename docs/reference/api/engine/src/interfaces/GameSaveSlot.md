[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / GameSaveSlot

# Interface: GameSaveSlot

Defined in: [engine/src/systems/SaveSystem.ts:11](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/SaveSystem.ts#L11)

Default shape of a save slot for a `startScene`-style game: one scene
name, a free-form data bag, and bookkeeping fields. This is the schema
`SaveSystem` uses when no custom schema is passed to its constructor —
it is a *default policy*, not something the generic persistence
mechanism enforces. Pass your own Zod schema to `SaveSystem` to store a
differently-shaped slot (see the class doc comment).

## Properties

### data

> `readonly` **data**: `Record`\<`string`, `unknown`\>

Defined in: [engine/src/systems/SaveSystem.ts:14](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/SaveSystem.ts#L14)

***

### id

> `readonly` **id**: `string`

Defined in: [engine/src/systems/SaveSystem.ts:12](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/SaveSystem.ts#L12)

***

### playtime

> `readonly` **playtime**: `number`

Defined in: [engine/src/systems/SaveSystem.ts:16](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/SaveSystem.ts#L16)

***

### scene

> `readonly` **scene**: `string`

Defined in: [engine/src/systems/SaveSystem.ts:13](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/SaveSystem.ts#L13)

***

### timestamp

> `readonly` **timestamp**: `number`

Defined in: [engine/src/systems/SaveSystem.ts:15](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/SaveSystem.ts#L15)

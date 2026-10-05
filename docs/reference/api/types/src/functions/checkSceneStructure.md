[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [types/src](../README.md) / checkSceneStructure

# Function: checkSceneStructure()

> **checkSceneStructure**(`doc`, `ctx`): `void`

Defined in: types/src/scene.ts:118

Cross-entity checks: unique ids, existing + acyclic parents, resolvable structural refs.

## Parameters

### doc

#### backgroundColor?

`string` = `...`

#### entities

`object`[] = `...`

#### formatVersion

`2` = `...`

#### id?

`string` = `...`

#### metadata?

\{ `author?`: `string`; `createdAt?`: `number`; `updatedAt?`: `number`; \} = `...`

#### metadata.author?

`string` = `...`

#### metadata.createdAt?

`number` = `...`

#### metadata.updatedAt?

`number` = `...`

#### name

`string` = `...`

#### persistent?

`boolean` = `...`

Room-level state cache flag (`roomSettings.persistent).

#### room?

\{ `height`: `number`; `layers?`: `object`[]; `views?`: `object`[]; `viewsEnabled?`: `boolean`; `width`: `number`; \} = `...`

#### room.height

`number` = `...`

#### room.layers?

`object`[] = `...`

#### room.views?

`object`[] = `...`

#### room.viewsEnabled?

`boolean` = `...`

#### room.width

`number` = `...`

#### systems?

`string`[] = `...`

### ctx

`RefinementCtx`

## Returns

`void`

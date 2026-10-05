[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / SaveFormatError

# Class: SaveFormatError

Defined in: engine/src/systems/SaveSystem.ts:24

Thrown by `load`/`peek` when a save was written by a newer build than this
one understands. Nothing is loaded in that case.

## Extends

- `Error`

## Constructors

### Constructor

> **new SaveFormatError**(`slotId`, `found`, `supported`): `SaveFormatError`

Defined in: engine/src/systems/SaveSystem.ts:25

#### Parameters

##### slotId

`string`

##### found

`unknown`

##### supported

`number`

#### Returns

`SaveFormatError`

#### Overrides

`Error.constructor`

## Properties

### found

> `readonly` **found**: `unknown`

Defined in: engine/src/systems/SaveSystem.ts:27

***

### slotId

> `readonly` **slotId**: `string`

Defined in: engine/src/systems/SaveSystem.ts:26

***

### supported

> `readonly` **supported**: `number`

Defined in: engine/src/systems/SaveSystem.ts:28

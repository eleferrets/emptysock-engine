[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / SaveHeader

# Interface: SaveHeader

Defined in: engine/src/systems/SaveSystem.ts:45

What `peek` reports without loading anything.

## Properties

### formatVersion

> `readonly` **formatVersion**: `number`

Defined in: engine/src/systems/SaveSystem.ts:46

***

### meta?

> `readonly` `optional` **meta?**: [`SaveMeta`](SaveMeta.md)

Defined in: engine/src/systems/SaveSystem.ts:47

***

### room?

> `readonly` `optional` **room?**: `string`

Defined in: engine/src/systems/SaveSystem.ts:49

Room/scene key current at save time, if the `SaveSystem` was given a `room` provider.

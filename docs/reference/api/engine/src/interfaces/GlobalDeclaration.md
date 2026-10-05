[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / GlobalDeclaration

# Interface: GlobalDeclaration

Defined in: engine/src/systems/GlobalStore.ts:35

What `GlobalStore.declare` records for a name.

## Properties

### initial?

> `readonly` `optional` **initial?**: [`Serializable`](../type-aliases/Serializable.md)

Defined in: engine/src/systems/GlobalStore.ts:37

Value the name takes on declare (when unset) and after `reset()`. Must be JSON-clean.

***

### persist?

> `readonly` `optional` **persist?**: `boolean`

Defined in: engine/src/systems/GlobalStore.ts:39

Only `persist: true` names enter `snapshot()` (and so save files). Default `false`.

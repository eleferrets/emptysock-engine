[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / RelationDef

# Interface: RelationDef

Defined in: engine/src/Relations.ts:27

A named, typed edge kind between entities of one scene.

## Properties

### acyclic

> `readonly` **acyclic**: `boolean`

Defined in: engine/src/Relations.ts:33

Reject edges that would make the graph cyclic (parent/child style).

***

### exclusive

> `readonly` **exclusive**: `boolean`

Defined in: engine/src/Relations.ts:31

A subject holds at most one target; relating again replaces it.

***

### name

> `readonly` **name**: `string`

Defined in: engine/src/Relations.ts:28

***

### onTargetDestroyed

> `readonly` **onTargetDestroyed**: [`TargetDestroyedPolicy`](../type-aliases/TargetDestroyedPolicy.md)

Defined in: engine/src/Relations.ts:29

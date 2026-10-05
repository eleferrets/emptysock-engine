[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / AStarSearchResult

# Interface: AStarSearchResult\<TNode\>

Defined in: engine/src/AStarSearch.ts:35

## Type Parameters

### TNode

`TNode`

## Properties

### found

> `readonly` **found**: `boolean`

Defined in: engine/src/AStarSearch.ts:38

***

### path

> `readonly` **path**: readonly `TNode`[]

Defined in: engine/src/AStarSearch.ts:37

Full path from start to goal, inclusive. Empty when `found` is false.

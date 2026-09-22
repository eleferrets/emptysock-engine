[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / AStarSearchResult

# Interface: AStarSearchResult\<TNode\>

Defined in: [engine/src/core/AStarSearch.ts:35](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/AStarSearch.ts#L35)

## Type Parameters

### TNode

`TNode`

## Properties

### found

> `readonly` **found**: `boolean`

Defined in: [engine/src/core/AStarSearch.ts:38](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/AStarSearch.ts#L38)

***

### path

> `readonly` **path**: readonly `TNode`[]

Defined in: [engine/src/core/AStarSearch.ts:37](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/AStarSearch.ts#L37)

Full path from start to goal, inclusive. Empty when `found` is false.

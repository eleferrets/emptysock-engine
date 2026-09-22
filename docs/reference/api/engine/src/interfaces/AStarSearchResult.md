[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / AStarSearchResult

# Interface: AStarSearchResult\<TNode\>

Defined in: [engine/src/core/AStarSearch.ts:35](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/AStarSearch.ts#L35)

## Type Parameters

### TNode

`TNode`

## Properties

### found

> `readonly` **found**: `boolean`

Defined in: [engine/src/core/AStarSearch.ts:38](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/AStarSearch.ts#L38)

***

### path

> `readonly` **path**: readonly `TNode`[]

Defined in: [engine/src/core/AStarSearch.ts:37](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/AStarSearch.ts#L37)

Full path from start to goal, inclusive. Empty when `found` is false.

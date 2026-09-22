[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / AStarSearchOptions

# Interface: AStarSearchOptions\<TNode\>

Defined in: [engine/src/core/AStarSearch.ts:22](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/AStarSearch.ts#L22)

## Type Parameters

### TNode

`TNode`

## Properties

### heuristic

> `readonly` **heuristic**: (`node`) => `number`

Defined in: [engine/src/core/AStarSearch.ts:30](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/AStarSearch.ts#L30)

Admissible heuristic estimate of the remaining cost from `node` to the goal.

#### Parameters

##### node

`TNode`

#### Returns

`number`

***

### isGoal

> `readonly` **isGoal**: (`node`) => `boolean`

Defined in: [engine/src/core/AStarSearch.ts:26](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/AStarSearch.ts#L26)

Returns true when `node` is an acceptable goal.

#### Parameters

##### node

`TNode`

#### Returns

`boolean`

***

### key

> `readonly` **key**: (`node`) => `string` \| `number`

Defined in: [engine/src/core/AStarSearch.ts:32](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/AStarSearch.ts#L32)

Returns a stable, unique identity for a node (used as the map/set key).

#### Parameters

##### node

`TNode`

#### Returns

`string` \| `number`

***

### neighbours

> `readonly` **neighbours**: (`node`) => readonly [`AStarEdge`](AStarEdge.md)\<`TNode`\>[]

Defined in: [engine/src/core/AStarSearch.ts:28](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/AStarSearch.ts#L28)

Returns the walkable neighbours of `node` and the cost to reach each one.

#### Parameters

##### node

`TNode`

#### Returns

readonly [`AStarEdge`](AStarEdge.md)\<`TNode`\>[]

***

### start

> `readonly` **start**: `TNode`

Defined in: [engine/src/core/AStarSearch.ts:24](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/AStarSearch.ts#L24)

The node to start the search from.

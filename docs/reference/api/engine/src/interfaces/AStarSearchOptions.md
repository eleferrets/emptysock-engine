[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / AStarSearchOptions

# Interface: AStarSearchOptions\<TNode\>

Defined in: engine/src/AStarSearch.ts:22

## Type Parameters

### TNode

`TNode`

## Properties

### heuristic

> `readonly` **heuristic**: (`node`) => `number`

Defined in: engine/src/AStarSearch.ts:30

Admissible heuristic estimate of the remaining cost from `node` to the goal.

#### Parameters

##### node

`TNode`

#### Returns

`number`

***

### isGoal

> `readonly` **isGoal**: (`node`) => `boolean`

Defined in: engine/src/AStarSearch.ts:26

Returns true when `node` is an acceptable goal.

#### Parameters

##### node

`TNode`

#### Returns

`boolean`

***

### key

> `readonly` **key**: (`node`) => `string` \| `number`

Defined in: engine/src/AStarSearch.ts:32

Returns a stable, unique identity for a node (used as the map/set key).

#### Parameters

##### node

`TNode`

#### Returns

`string` \| `number`

***

### neighbours

> `readonly` **neighbours**: (`node`) => readonly `AStarEdge`\<`TNode`\>[]

Defined in: engine/src/AStarSearch.ts:28

Returns the walkable neighbours of `node` and the cost to reach each one.

#### Parameters

##### node

`TNode`

#### Returns

readonly `AStarEdge`\<`TNode`\>[]

***

### start

> `readonly` **start**: `TNode`

Defined in: engine/src/AStarSearch.ts:24

The node to start the search from.

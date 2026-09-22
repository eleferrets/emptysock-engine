[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / AStarSearch

# Function: AStarSearch()

> **AStarSearch**\<`TNode`\>(`options`): [`AStarSearchResult`](../interfaces/AStarSearchResult.md)\<`TNode`\>

Defined in: [engine/src/core/AStarSearch.ts:136](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/AStarSearch.ts#L136)

Run a generic A* search over any weighted graph.

## Type Parameters

### TNode

`TNode`

## Parameters

### options

[`AStarSearchOptions`](../interfaces/AStarSearchOptions.md)\<`TNode`\>

## Returns

[`AStarSearchResult`](../interfaces/AStarSearchResult.md)\<`TNode`\>

## Example

```ts
const result = AStarSearch({
  start: { x: 0, y: 0 },
  isGoal: (n) => n.x === 5 && n.y === 5,
  neighbours: (n) => grid.neighboursOf(n),
  heuristic: (n) => Math.abs(n.x - 5) + Math.abs(n.y - 5),
  key: (n) => `${n.x},${n.y}`,
});
```

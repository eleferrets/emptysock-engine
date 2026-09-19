# AStarSearch

`AStarSearch` is a generic, weighted-graph A\* search. It is the shared implementation behind `PathfindingSystem` (grid graphs) and `NavMeshSystem` (polygon graphs) — both are thin adapters over it. Use it directly when you have your own graph shape (a dialogue tree, a room graph, a custom spatial structure) and want A\* without writing an open-list and heap yourself.

Import: `import { AStarSearch } from '@emptysock/engine';`

---

## `AStarSearch<TNode>(options): AStarSearchResult<TNode>`

```typescript
interface AStarEdge<TNode> {
  node: TNode;
  cost: number;
}

interface AStarSearchOptions<TNode> {
  start: TNode;
  isGoal: (node: TNode) => boolean;
  neighbours: (node: TNode) => readonly AStarEdge<TNode>[];
  heuristic: (node: TNode) => number;
  key: (node: TNode) => string | number;
}

interface AStarSearchResult<TNode> {
  path: readonly TNode[];
  found: boolean;
}
```

- `start` — the node to begin the search from.
- `isGoal` — returns true when a node is an acceptable destination. Supports goal predicates, not just single-node equality.
- `neighbours` — returns the walkable edges out of a node, each with its own traversal cost.
- `heuristic` — an admissible estimate of the remaining cost to the goal. Return `0` everywhere for plain Dijkstra behaviour.
- `key` — a stable, unique identity for a node, used internally as the map/set key. A grid cell might key on `"x,y"`; a graph node with a numeric id can key on that id directly.

Internally the search uses a binary min-heap for the open list (O(log n) push/pop) rather than a linear scan, so it stays efficient on large graphs.

### Example: pathfinding over a custom graph

```typescript
import { AStarSearch } from "@emptysock/engine";

interface RoomNode {
  id: string;
  x: number;
  y: number;
}

const rooms: Record<string, RoomNode[]> = {
  /* adjacency map built elsewhere */
};

const result = AStarSearch<RoomNode>({
  start: roomA,
  isGoal: (n) => n.id === roomZ.id,
  heuristic: (n) => Math.hypot(n.x - roomZ.x, n.y - roomZ.y),
  key: (n) => n.id,
  neighbours: (n) =>
    rooms[n.id].map((neighbour) => ({
      node: neighbour,
      cost: Math.hypot(neighbour.x - n.x, neighbour.y - n.y),
    })),
});

if (result.found) {
  // result.path is the full node sequence from start to goal, inclusive.
}
```

---

## Notes

- `result.path` is always the complete path (start through goal) when `found` is `true`. There is no partial-path return.
- If `start` already satisfies `isGoal`, the result is a single-node path.
- `AStarSearch` has no knowledge of grids, tiles, or polygons — see [PathfindingSystem](../../guides/navigation.md) and [NavMeshSystem](./nav-mesh-system.md) for the ready-made adapters most games should reach for first.

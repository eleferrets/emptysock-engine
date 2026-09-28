/**
 * Generic weighted-graph A* search.
 *
 * PathfindingSystem (grid graph) and NavMeshSystem (polygon graph) both used
 * to hand-roll their own A* implementation over their own node shape. This
 * module factors the search itself — the open-list heap, the closed set,
 * lazy-deletion updates, and path reconstruction — out into something either
 * caller can drive with a `neighbours()` function over its own node type.
 *
 * Nodes are identified by a caller-supplied `key()` function rather than by
 * reference or structural equality, since a grid cell and a nav polygon have
 * completely different natural identities (an `"x,y"` string vs a numeric
 * polygon id).
 */
/** One edge out of a node during expansion: the neighbour and its move cost. */
export interface AStarEdge<TNode> {
  readonly node: TNode;
  readonly cost: number;
}
export interface AStarSearchOptions<TNode> {
  /** The node to start the search from. */
  readonly start: TNode;
  /** Returns true when `node` is an acceptable goal. */
  readonly isGoal: (node: TNode) => boolean;
  /** Returns the walkable neighbours of `node` and the cost to reach each one. */
  readonly neighbours: (node: TNode) => ReadonlyArray<AStarEdge<TNode>>;
  /** Admissible heuristic estimate of the remaining cost from `node` to the goal. */
  readonly heuristic: (node: TNode) => number;
  /** Returns a stable, unique identity for a node (used as the map/set key). */
  readonly key: (node: TNode) => string | number;
}
export interface AStarSearchResult<TNode> {
  /** Full path from start to goal, inclusive. Empty when `found` is false. */
  readonly path: ReadonlyArray<TNode>;
  readonly found: boolean;
}
/**
 * Run a generic A* search over any weighted graph.
 *
 * @example
 * const result = AStarSearch({
 *   start: { x: 0, y: 0 },
 *   isGoal: (n) => n.x === 5 && n.y === 5,
 *   neighbours: (n) => grid.neighboursOf(n),
 *   heuristic: (n) => Math.abs(n.x - 5) + Math.abs(n.y - 5),
 *   key: (n) => `${n.x},${n.y}`,
 * });
 */
export declare function AStarSearch<TNode>(
  options: AStarSearchOptions<TNode>,
): AStarSearchResult<TNode>;

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

interface HeapEntry<TNode> {
  readonly node: TNode;
  readonly key: string | number;
  readonly g: number;
  readonly f: number;
}

// ---------------------------------------------------------------------------
// Binary min-heap keyed by f-score.
// ---------------------------------------------------------------------------
// push() and pop() both run in O(log n), making the overall search
// O(E log V) instead of the O(V^2) an open-list linear scan produces.
//
// Lazy deletion handles updates: when a shorter path to a node is found, an
// improved entry is pushed again rather than mutating the existing one in
// place. Stale copies (higher g than the best known g) are discarded when
// they surface during pop() — no heap-index map is needed.
class AStarMinHeap<TNode> {
  private readonly _data: Array<HeapEntry<TNode>> = [];

  get size(): number {
    return this._data.length;
  }

  push(entry: HeapEntry<TNode>): void {
    this._data.push(entry);
    this._siftUp(this._data.length - 1);
  }

  /** Removes and returns the entry with the smallest f. Caller must ensure size > 0. */
  pop(): HeapEntry<TNode> {
    const top = this._data[0] as HeapEntry<TNode>;
    const last = this._data.pop() as HeapEntry<TNode>;
    if (this._data.length > 0) {
      this._data[0] = last;
      this._siftDown(0);
    }
    return top;
  }

  private _siftUp(idx: number): void {
    const data = this._data;
    let i = idx;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (
        (data[parent] as HeapEntry<TNode>).f <= (data[i] as HeapEntry<TNode>).f
      )
        break;
      const tmp = data[parent] as HeapEntry<TNode>;
      data[parent] = data[i] as HeapEntry<TNode>;
      data[i] = tmp;
      i = parent;
    }
  }

  private _siftDown(idx: number): void {
    const data = this._data;
    const n = data.length;
    let i = idx;
    for (;;) {
      let smallest = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (
        l < n &&
        (data[l] as HeapEntry<TNode>).f < (data[smallest] as HeapEntry<TNode>).f
      )
        smallest = l;
      if (
        r < n &&
        (data[r] as HeapEntry<TNode>).f < (data[smallest] as HeapEntry<TNode>).f
      )
        smallest = r;
      if (smallest === i) break;
      const tmp = data[i] as HeapEntry<TNode>;
      data[i] = data[smallest] as HeapEntry<TNode>;
      data[smallest] = tmp;
      i = smallest;
    }
  }
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
export function AStarSearch<TNode>(
  options: AStarSearchOptions<TNode>,
): AStarSearchResult<TNode> {
  const { start, isGoal, neighbours, heuristic, key } = options;

  const startKey = key(start);
  if (isGoal(start)) {
    return { path: [start], found: true };
  }

  const open = new AStarMinHeap<TNode>();
  const closed = new Set<string | number>();
  const bestG = new Map<string | number, number>();
  const cameFromKey = new Map<string | number, string | number | null>();
  const nodesByKey = new Map<string | number, TNode>();

  bestG.set(startKey, 0);
  cameFromKey.set(startKey, null);
  nodesByKey.set(startKey, start);
  open.push({ node: start, key: startKey, g: 0, f: heuristic(start) });

  while (open.size > 0) {
    const current = open.pop();

    // Lazy deletion: a stale copy surfaces when a shorter path was already
    // found and a better entry was pushed without removing this one.
    const knownG = bestG.get(current.key);
    if (knownG !== undefined && current.g > knownG) continue;
    if (closed.has(current.key)) continue;
    closed.add(current.key);

    if (isGoal(current.node)) {
      return {
        path: _reconstruct(current.key, nodesByKey, cameFromKey),
        found: true,
      };
    }

    for (const edge of neighbours(current.node)) {
      const nKey = key(edge.node);
      if (closed.has(nKey)) continue;

      const g = current.g + edge.cost;
      const prevBestG = bestG.get(nKey);
      if (prevBestG === undefined || g < prevBestG) {
        bestG.set(nKey, g);
        cameFromKey.set(nKey, current.key);
        nodesByKey.set(nKey, edge.node);
        open.push({
          node: edge.node,
          key: nKey,
          g,
          f: g + heuristic(edge.node),
        });
      }
    }
  }

  return { path: [], found: false };
}

function _reconstruct<TNode>(
  goalKey: string | number,
  nodesByKey: Map<string | number, TNode>,
  cameFromKey: Map<string | number, string | number | null>,
): TNode[] {
  const path: TNode[] = [];
  let curKey: string | number | null = goalKey;
  while (curKey !== null) {
    const node = nodesByKey.get(curKey);
    if (node === undefined) break;
    path.unshift(node);
    curKey = cameFromKey.get(curKey) ?? null;
  }
  return path;
}

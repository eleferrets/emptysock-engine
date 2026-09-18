export interface GridCell {
  readonly walkable: boolean;
  readonly weight: number;
}

export interface PathRequest {
  readonly from: { readonly x: number; readonly y: number };
  readonly to: { readonly x: number; readonly y: number };
  readonly grid: ReadonlyArray<ReadonlyArray<GridCell>>;
  readonly allowDiagonal: boolean;
}

export interface PathResult {
  readonly path: ReadonlyArray<{ readonly x: number; readonly y: number }>;
  readonly found: boolean;
}

interface AStarNode {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: AStarNode | null;
}

class AStarMinHeap {
  private readonly _heap: AStarNode[] = [];

  get size(): number { return this._heap.length; }

  push(node: AStarNode): void {
    this._heap.push(node);
    this._bubbleUp(this._heap.length - 1);
  }

  pop(): AStarNode | undefined {
    const top = this._heap[0];
    const last = this._heap.pop();
    if (this._heap.length > 0 && last !== undefined) {
      this._heap[0] = last;
      this._siftDown(0);
    }
    return top;
  }

  private _bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      const h = this._heap;
      if ((h[parent]?.f ?? Infinity) <= (h[i]?.f ?? Infinity)) break;
      const tmp = h[parent] as AStarNode;
      h[parent] = h[i] as AStarNode;
      h[i] = tmp;
      i = parent;
    }
  }

  private _siftDown(i: number): void {
    const n = this._heap.length;
    const h = this._heap;
    for (;;) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      let smallest = i;
      if (left < n && (h[left]?.f ?? Infinity) < (h[smallest]?.f ?? Infinity)) smallest = left;
      if (right < n && (h[right]?.f ?? Infinity) < (h[smallest]?.f ?? Infinity)) smallest = right;
      if (smallest === i) break;
      const tmp = h[i] as AStarNode;
      h[i] = h[smallest] as AStarNode;
      h[smallest] = tmp;
      i = smallest;
    }
  }
}

export class PathfindingSystem {
  findPath(request: PathRequest): PathResult {
    const { from, to, grid, allowDiagonal } = request;
    const rows = grid.length;
    if (rows === 0) return { path: [], found: false };
    const cols = grid[0]?.length ?? 0;
    if (cols === 0) return { path: [], found: false };

    const key = (x: number, y: number): string => `${x},${y}`;

    const open = new AStarMinHeap();
    const gScore: Map<string, number> = new Map();
    const closed: Set<string> = new Set();

    const heuristic = (x: number, y: number): number =>
      Math.abs(x - to.x) + Math.abs(y - to.y);

    const startH = heuristic(from.x, from.y);
    const start: AStarNode = { x: from.x, y: from.y, g: 0, h: startH, f: startH, parent: null };
    open.push(start);
    gScore.set(key(from.x, from.y), 0);

    while (open.size > 0) {
      const current = open.pop();
      if (current === undefined) break;

      const ck = key(current.x, current.y);
      if (closed.has(ck)) continue; // stale heap entry
      closed.add(ck);

      if (current.x === to.x && current.y === to.y) {
        const path: Array<{ x: number; y: number }> = [];
        let n: AStarNode | null = current;
        while (n !== null) {
          path.unshift({ x: n.x, y: n.y });
          n = n.parent;
        }
        return { path, found: true };
      }

      const dirs: ReadonlyArray<readonly [number, number]> = allowDiagonal
        ? [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]] as const
        : [[-1,0],[1,0],[0,-1],[0,1]] as const;

      for (const dir of dirs) {
        const dx = dir[0];
        const dy = dir[1];
        const nx = current.x + dx;
        const ny = current.y + dy;
        if (nx < 0 || ny < 0 || ny >= rows || nx >= cols) continue;
        const row = grid[ny];
        if (row === undefined) continue;
        const cell = row[nx];
        if (cell === undefined || !cell.walkable) continue;
        const nk = key(nx, ny);
        if (closed.has(nk)) continue;

        const moveCost = (dx !== 0 && dy !== 0) ? 1.414 : 1;
        const g = current.g + moveCost * cell.weight;
        if (g >= (gScore.get(nk) ?? Infinity)) continue;
        gScore.set(nk, g);
        const h = heuristic(nx, ny);
        open.push({ x: nx, y: ny, g, h, f: g + h, parent: current });
      }
    }

    return { path: [], found: false };
  }

  update(_dt: number): void {
    // No per-frame work needed; findPath is on-demand
  }
}

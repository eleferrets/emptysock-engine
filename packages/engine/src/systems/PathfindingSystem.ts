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

export class PathfindingSystem {
  findPath(request: PathRequest): PathResult {
    const { from, to, grid, allowDiagonal } = request;
    const rows = grid.length;
    if (rows === 0) return { path: [], found: false };
    const cols = grid[0]?.length ?? 0;
    if (cols === 0) return { path: [], found: false };

    const key = (x: number, y: number): string => `${x},${y}`;

    const open: Map<string, AStarNode> = new Map();
    const closed: Set<string> = new Set();

    const heuristic = (x: number, y: number): number =>
      Math.abs(x - to.x) + Math.abs(y - to.y);

    const start: AStarNode = { x: from.x, y: from.y, g: 0, h: heuristic(from.x, from.y), f: 0, parent: null };
    start.f = start.g + start.h;
    open.set(key(from.x, from.y), start);

    while (open.size > 0) {
      let current: AStarNode | null = null;
      for (const node of open.values()) {
        if (current === null || node.f < current.f) current = node;
      }
      if (current === null) break;

      if (current.x === to.x && current.y === to.y) {
        const path: Array<{ x: number; y: number }> = [];
        let n: AStarNode | null = current;
        while (n !== null) {
          path.unshift({ x: n.x, y: n.y });
          n = n.parent;
        }
        return { path, found: true };
      }

      open.delete(key(current.x, current.y));
      closed.add(key(current.x, current.y));

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
        const h = heuristic(nx, ny);
        const f = g + h;

        const existing = open.get(nk);
        if (existing === undefined || g < existing.g) {
          open.set(nk, { x: nx, y: ny, g, h, f, parent: current });
        }
      }
    }

    return { path: [], found: false };
  }

  update(_dt: number): void {
    // No per-frame work needed; findPath is on-demand
  }
}

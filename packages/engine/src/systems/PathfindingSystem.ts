import { AStarSearch } from "../core/AStarSearch.js";

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

interface GridNode {
  readonly x: number;
  readonly y: number;
}

const ORTHOGONAL_DIRS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

const DIAGONAL_DIRS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

export class PathfindingSystem {
  private _grid: ReadonlyArray<ReadonlyArray<GridCell>> | null = null;
  private _allowDiagonal = false;

  /**
   * Attach a static grid so `findPath(from, to)` can be called without
   * passing the grid on every request. Call this once in `onLoad` and then
   * use the two-argument shorthand for all subsequent pathfinding.
   *
   * Accepts the `boolean[][]` produced by `Tilemap.asGrid()` directly, or a
   * `GridCell[][]` when per-cell movement weight is needed.
   *
   * @param allowDiagonal Allow diagonal movement. Default false.
   *
   * @example
   * pf.setGrid(tilemap.asGrid(), true);
   * // later, in game logic:
   * const { path } = pf.findPath({ x: 0, y: 0 }, { x: 10, y: 5 });
   */
  setGrid(
    grid:
      | ReadonlyArray<ReadonlyArray<GridCell>>
      | ReadonlyArray<ReadonlyArray<boolean>>,
    allowDiagonal = false,
  ): void {
    this._grid = _asCellGrid(grid);
    this._allowDiagonal = allowDiagonal;
  }

  /**
   * Find a path using A*.
   *
   * Two call signatures:
   * - `findPath(request)` — full PathRequest; grid is passed inline each call.
   * - `findPath(from, to)` — shorthand when a grid is attached via `setGrid()`.
   */
  findPath(request: PathRequest): PathResult;
  findPath(
    from: { readonly x: number; readonly y: number },
    to: { readonly x: number; readonly y: number },
  ): PathResult;
  findPath(
    requestOrFrom: PathRequest | { readonly x: number; readonly y: number },
    to?: { readonly x: number; readonly y: number },
  ): PathResult {
    let req: PathRequest;

    if (to !== undefined) {
      if (this._grid === null) {
        console.warn(
          "[PathfindingSystem] findPath(from, to) requires setGrid() to be called first.",
        );
        return { path: [], found: false };
      }
      req = {
        from: requestOrFrom as { x: number; y: number },
        to,
        grid: this._grid,
        allowDiagonal: this._allowDiagonal,
      };
    } else {
      req = requestOrFrom as PathRequest;
    }

    return this._runAStar(req);
  }

  private _runAStar(request: PathRequest): PathResult {
    const { from, to, grid, allowDiagonal } = request;
    const rows = grid.length;
    if (rows === 0) return { path: [], found: false };
    const cols = grid[0]?.length ?? 0;
    if (cols === 0) return { path: [], found: false };

    const startCell = grid[from.y]?.[from.x];
    if (startCell === undefined) return { path: [], found: false };

    const dirs = allowDiagonal ? DIAGONAL_DIRS : ORTHOGONAL_DIRS;

    const result = AStarSearch<GridNode>({
      start: { x: from.x, y: from.y },
      isGoal: (node) => node.x === to.x && node.y === to.y,
      heuristic: (node) => Math.abs(node.x - to.x) + Math.abs(node.y - to.y),
      key: (node) => `${node.x},${node.y}`,
      neighbours: (node) => {
        const edges: Array<{ node: GridNode; cost: number }> = [];
        for (const [dx, dy] of dirs) {
          const nx = node.x + dx;
          const ny = node.y + dy;
          if (nx < 0 || ny < 0 || ny >= rows || nx >= cols) continue;
          const row = grid[ny];
          if (row === undefined) continue;
          const cell = row[nx];
          if (cell === undefined || !cell.walkable) continue;
          const moveCost = dx !== 0 && dy !== 0 ? 1.414 : 1;
          edges.push({ node: { x: nx, y: ny }, cost: moveCost * cell.weight });
        }
        return edges;
      },
    });

    return { path: result.path, found: result.found };
  }

  update(_dt: number): void {
    // No per-frame work needed; findPath is on-demand
  }
}

/**
 * Normalise a raw `boolean[][]` walkability grid (as returned by
 * `Tilemap.asGrid()`) or an already-built `GridCell[][]` into the
 * `GridCell[][]` shape `PathfindingSystem` operates on internally, so
 * `setGrid(tilemap.asGrid())` works as a single call with no manual bridging.
 */
function _asCellGrid(
  grid:
    | ReadonlyArray<ReadonlyArray<GridCell>>
    | ReadonlyArray<ReadonlyArray<boolean>>,
): ReadonlyArray<ReadonlyArray<GridCell>> {
  if (grid.length === 0) return grid as ReadonlyArray<ReadonlyArray<GridCell>>;
  const firstRow = grid[0];
  if (firstRow === undefined || firstRow.length === 0) {
    return grid as ReadonlyArray<ReadonlyArray<GridCell>>;
  }
  const firstCell = firstRow[0];
  if (typeof firstCell === "boolean") {
    const boolGrid = grid as ReadonlyArray<ReadonlyArray<boolean>>;
    return boolGrid.map((row) =>
      row.map((walkable) => ({ walkable, weight: 1 }) satisfies GridCell),
    );
  }
  return grid as ReadonlyArray<ReadonlyArray<GridCell>>;
}

export interface GridCell {
  readonly walkable: boolean;
  readonly weight: number;
}
export interface PathRequest {
  readonly from: {
    readonly x: number;
    readonly y: number;
  };
  readonly to: {
    readonly x: number;
    readonly y: number;
  };
  readonly grid: ReadonlyArray<ReadonlyArray<GridCell>>;
  readonly allowDiagonal: boolean;
}
export interface PathResult {
  readonly path: ReadonlyArray<{
    readonly x: number;
    readonly y: number;
  }>;
  readonly found: boolean;
}
export declare class PathfindingSystem {
  private _grid;
  private _allowDiagonal;
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
    allowDiagonal?: boolean,
  ): void;
  /**
   * Find a path using A*.
   *
   * Two call signatures:
   * - `findPath(request)` — full PathRequest; grid is passed inline each call.
   * - `findPath(from, to)` — shorthand when a grid is attached via `setGrid()`.
   */
  findPath(request: PathRequest): PathResult;
  findPath(
    from: {
      readonly x: number;
      readonly y: number;
    },
    to: {
      readonly x: number;
      readonly y: number;
    },
  ): PathResult;
  private _runAStar;
  update(_dt: number): void;
}

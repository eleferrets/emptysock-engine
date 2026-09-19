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
  findPath(request: PathRequest): PathResult;
  update(_dt: number): void;
}

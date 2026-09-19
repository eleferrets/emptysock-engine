import type { Scene } from "../core/Scene.js";
import { Entity } from "../core/Entity.js";
export interface TilesetConfig {
  /** Path to tileset image */
  imagePath: string;
  tileWidth: number;
  tileHeight: number;
  columns: number;
  rows: number;
  spacing?: number;
  margin?: number;
}
export interface TileCell {
  /** Tileset tile index (0-based). -1 = empty. */
  tileIndex: number;
  /** Whether this cell blocks movement */
  solid?: boolean;
}
export interface TilemapLayer {
  name: string;
  cells: TileCell[][];
  visible: boolean;
  opacity: number;
}
export interface TilemapData {
  name: string;
  tileWidth: number;
  tileHeight: number;
  cols: number;
  rows: number;
  tileset: TilesetConfig;
  layers: TilemapLayer[];
}
export declare class Tilemap {
  readonly data: TilemapData;
  readonly entity: Entity;
  private readonly _layerIndex;
  constructor(data: TilemapData, entity: Entity);
  get width(): number;
  get height(): number;
  getLayer(name: string): TilemapLayer | undefined;
  /** Return all solid cells across all layers as a flat walkability grid (true = walkable). */
  asGrid(): boolean[][];
  /** World-space tile at (x, y). */
  tileAt(worldX: number, worldY: number, layerName: string): TileCell | null;
}
declare class TilemapSystemImpl {
  private readonly _maps;
  /** Register a map from parsed JSON data. */
  register(data: TilemapData): Tilemap;
  /** Load a tilemap into the scene (adds its root entity). */
  loadInto(scene: Scene, name: string): Tilemap;
  get(name: string): Tilemap | undefined;
  remove(name: string): boolean;
}
export declare const TilemapSystem: TilemapSystemImpl;
export {};

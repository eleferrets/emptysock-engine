import type { Scene } from "../core/Scene.js";
import { Entity } from "../core/Entity.js";
import { Transform } from "../components/Transform.js";

// ─── Tilemap data model ───────────────────────────────────────────────────────

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

// ─── Runtime tilemap ──────────────────────────────────────────────────────────

export class Tilemap {
  public readonly data: TilemapData;
  public readonly entity: Entity;
  private readonly _layerIndex: Map<string, TilemapLayer>;

  constructor(data: TilemapData, entity: Entity) {
    this.data = data;
    this.entity = entity;
    this._layerIndex = new Map(data.layers.map((l) => [l.name, l]));
  }

  get width(): number {
    return this.data.cols * this.data.tileWidth;
  }
  get height(): number {
    return this.data.rows * this.data.tileHeight;
  }

  getLayer(name: string): TilemapLayer | undefined {
    return this._layerIndex.get(name);
  }

  /** Return all solid cells across all layers as a flat walkability grid (true = walkable). */
  asGrid(): boolean[][] {
    const grid: boolean[][] = Array.from(
      { length: this.data.rows },
      () => Array(this.data.cols).fill(true) as boolean[],
    );

    for (const layer of this.data.layers) {
      for (let row = 0; row < this.data.rows; row++) {
        for (let col = 0; col < this.data.cols; col++) {
          const cell = layer.cells[row]?.[col];
          if (cell !== undefined && cell.solid === true) {
            const rowArr = grid[row];
            if (rowArr !== undefined) rowArr[col] = false;
          }
        }
      }
    }
    return grid;
  }

  /** World-space tile at (x, y). */
  tileAt(worldX: number, worldY: number, layerName: string): TileCell | null {
    const col = Math.floor(worldX / this.data.tileWidth);
    const row = Math.floor(worldY / this.data.tileHeight);
    const layer = this.getLayer(layerName);
    return layer?.cells[row]?.[col] ?? null;
  }
}

// ─── System ───────────────────────────────────────────────────────────────────

class TilemapSystemImpl {
  private readonly _maps: Map<string, Tilemap> = new Map();

  /** Register a map from parsed JSON data. */
  register(data: TilemapData): Tilemap {
    const entity = new Entity(data.name);
    entity.addComponent(new Transform());
    const tilemap = new Tilemap(data, entity);
    this._maps.set(data.name, tilemap);
    return tilemap;
  }

  /** Load a tilemap into the scene (adds its root entity). */
  loadInto(scene: Scene, name: string): Tilemap {
    const map = this._maps.get(name);
    if (map === undefined) {
      throw new Error(`TilemapSystem: no map registered as "${name}"`);
    }
    scene.addEntity(map.entity);
    return map;
  }

  get(name: string): Tilemap | undefined {
    return this._maps.get(name);
  }

  remove(name: string): boolean {
    return this._maps.delete(name);
  }
}

export const TilemapSystem = new TilemapSystemImpl();

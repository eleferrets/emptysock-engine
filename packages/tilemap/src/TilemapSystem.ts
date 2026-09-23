import type { Scene, Entity } from "@emptysock/engine/ecs";
import { Transform } from "@emptysock/engine/ecs";

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
  private readonly _layerIndex: Map<string, TilemapLayer>;
  /**
   * `null` until `TilemapSystem.loadInto()` spawns this map's root entity
   * into a real `Scene` — unlike the classic `Entity`, an ECS `Entity` is
   * always scoped to one `Scene`'s bitECS `World` and cannot exist before
   * one does, so `register()` (called before any `Scene` necessarily
   * exists) can only construct the map's plain data, not its entity.
   */
  private _entity: Entity | null = null;

  constructor(data: TilemapData) {
    this.data = data;
    this._layerIndex = new Map(data.layers.map((l) => [l.name, l]));
  }

  get entity(): Entity | null {
    return this._entity;
  }

  /** @internal set once by `TilemapSystem.loadInto()`. */
  _bindEntity(entity: Entity): void {
    this._entity = entity;
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

  /** Register a map from parsed JSON data. No entity exists yet — call `loadInto()` once a `Scene` is available. */
  register(data: TilemapData): Tilemap {
    const tilemap = new Tilemap(data);
    this._maps.set(data.name, tilemap);
    return tilemap;
  }

  /** Load a tilemap into the scene — spawns its root entity and binds it to the previously-registered `Tilemap`. */
  loadInto(scene: Scene, name: string): Tilemap {
    const map = this._maps.get(name);
    if (map === undefined) {
      throw new Error(`TilemapSystem: no map registered as "${name}"`);
    }
    const entity = scene.spawn(map.data.name);
    entity.add(Transform);
    map._bindEntity(entity);
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

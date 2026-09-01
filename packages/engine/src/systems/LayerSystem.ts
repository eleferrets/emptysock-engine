// LayerSystem — explicit named rendering layers with per-entity depth.
//
// Unlike GMS2's global `depth` variable (which is a magic integer that the
// runtime re-sorts without telling you), depth here is always explicit:
//   layer.addEntity(entity.id, 'foreground', 10)
// The renderer calls getSortKey(id) and sorts ascending: lower layerIndex
// first (drawn behind), then lower depth within the same layer (also behind).
// Nothing is ever sorted implicitly.

/** Index constants for the built-in layers. */
export const LAYER = {
  BACKGROUND: -1000,
  DEFAULT: 0,
  FOREGROUND: 100,
  UI: 1000,
} as const;

export interface LayerConfig {
  readonly name: string;
  index: number;
  visible: boolean;
}

/** Per-entity placement within a layer. */
interface EntityPlacement {
  layerName: string;
  depth: number;
}

/**
 * Opaque sort key the renderer uses to order draw calls.
 * [layerIndex, depth] — sort ascending on both fields.
 */
export type LayerSortKey = [layerIndex: number, depth: number];

export class LayerSystem {
  private readonly _layers: Map<string, LayerConfig> = new Map();
  /** Entity id → placement. All entity IDs in the engine are numbers. */
  private readonly _placements: Map<number, EntityPlacement> = new Map();

  constructor() {
    this._define('background', LAYER.BACKGROUND);
    this._define('default', LAYER.DEFAULT);
    this._define('foreground', LAYER.FOREGROUND);
    this._define('ui', LAYER.UI);
  }

  private _define(name: string, index: number): void {
    this._layers.set(name, { name, index, visible: true });
  }

  /** Define or redefine a layer. Lower index = drawn first (behind). */
  defineLayer(name: string, index: number): void {
    const existing = this._layers.get(name);
    if (existing !== undefined) {
      existing.index = index;
    } else {
      this._define(name, index);
    }
  }

  /**
   * Assign an entity to a layer at a specific depth.
   * depth controls draw order within the layer: lower depth = drawn first (behind).
   * Default depth is 0. Unlike GMS2, this never changes implicitly.
   */
  addEntity(entityId: number, layerName: string, depth = 0): void {
    if (!this._layers.has(layerName)) {
      console.warn(`[LayerSystem] Unknown layer "${layerName}" — entity ${entityId} assigned to "default" instead.`);
      this._placements.set(entityId, { layerName: 'default', depth });
      return;
    }
    this._placements.set(entityId, { layerName, depth });
  }

  removeEntity(entityId: number): void {
    this._placements.delete(entityId);
  }

  /** Update an entity's depth within its current layer without changing the layer. */
  setDepth(entityId: number, depth: number): void {
    const p = this._placements.get(entityId);
    if (p !== undefined) p.depth = depth;
  }

  getEntityLayer(entityId: number): string | null {
    return this._placements.get(entityId)?.layerName ?? null;
  }

  getEntityDepth(entityId: number): number {
    return this._placements.get(entityId)?.depth ?? 0;
  }

  /**
   * Returns the sort key for a single entity.
   * Pass the result array into Array.sort for stable, explicit ordering:
   *   entities.sort((a, b) => {
   *     const [al, ad] = layers.getSortKey(a.id);
   *     const [bl, bd] = layers.getSortKey(b.id);
   *     return al !== bl ? al - bl : ad - bd;
   *   });
   */
  getSortKey(entityId: number): LayerSortKey {
    const p = this._placements.get(entityId);
    if (p === undefined) return [LAYER.DEFAULT, 0];
    const layerIndex = this._layers.get(p.layerName)?.index ?? LAYER.DEFAULT;
    return [layerIndex, p.depth];
  }

  getLayerIndex(name: string): number {
    return this._layers.get(name)?.index ?? LAYER.DEFAULT;
  }

  setVisible(name: string, visible: boolean): void {
    const layer = this._layers.get(name);
    if (layer !== undefined) layer.visible = visible;
  }

  isVisible(name: string): boolean {
    return this._layers.get(name)?.visible ?? true;
  }

  /** Returns all entities on a given layer, sorted by depth ascending. */
  getEntitiesOnLayer(layerName: string): Array<{ entityId: number; depth: number }> {
    const result: Array<{ entityId: number; depth: number }> = [];
    for (const [id, p] of this._placements) {
      if (p.layerName === layerName) result.push({ entityId: id, depth: p.depth });
    }
    result.sort((a, b) => a.depth - b.depth);
    return result;
  }

  /** All layer configs sorted by index ascending (render order). */
  getLayersSorted(): LayerConfig[] {
    return Array.from(this._layers.values()).sort((a, b) => a.index - b.index);
  }

  destroy(): void {
    this._layers.clear();
    this._placements.clear();
  }
}

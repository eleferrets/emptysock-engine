// LayerSystem — explicit named rendering layers with per-entity depth.
//
// Unlike global `depth` variable (which is a magic integer that the
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
  /** Layer name → render-position offset, for `layer_x`/`layer_y`. */
  private readonly _offsets: Map<string, { x: number; y: number }> = new Map();

  constructor() {
    this._define("background", LAYER.BACKGROUND);
    this._define("default", LAYER.DEFAULT);
    this._define("foreground", LAYER.FOREGROUND);
    this._define("ui", LAYER.UI);
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
   * Default depth is 0. This never changes implicitly.
   */
  addEntity(entityId: number, layerName: string, depth = 0): void {
    if (!this._layers.has(layerName)) {
      console.warn(
        `[LayerSystem] Unknown layer "${layerName}" — entity ${entityId} assigned to "default" instead.`,
      );
      this._placements.set(entityId, { layerName: "default", depth });
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

  /** True if a layer with this exact name has been defined — the real
   * backing for `layer_exists()` compat function
   *. */
  hasLayer(name: string): boolean {
    return this._layers.has(name);
  }

  /**
   * Set a named layer's render-position offset — the real backing for
   * `layer_x`/`layer_y` compat functions,
   * typically used for manual parallax scrolling. A no-op for a layer that
   * hasn't been defined (`defineLayer()`/the built-in four) — matching this
   * codebase's established "no live layer/instance to even ask" honest
   * no-op convention (`QueryChannel`'s `no-live-instance`,
   * camera-follow's no-target no-op) rather than fabricating a new
   * layer just to hold an offset nobody will ever render.
   */
  setOffset(name: string, x: number, y: number): void {
    const layer = this._layers.get(name);
    if (layer === undefined) return;
    this._offsets.set(name, { x, y });
  }

  /** A named layer's current render-position offset, `{ x: 0, y: 0 }` if
   * none was ever set — the same default an offset-free layer always had
   * before `layer_x`/`layer_y` existed. */
  getOffset(name: string): { x: number; y: number } {
    return this._offsets.get(name) ?? { x: 0, y: 0 };
  }

  /** Returns all entities on a given layer, sorted by depth ascending. */
  getEntitiesOnLayer(
    layerName: string,
  ): Array<{ entityId: number; depth: number }> {
    const result: Array<{ entityId: number; depth: number }> = [];
    for (const [id, p] of this._placements) {
      if (p.layerName === layerName)
        result.push({ entityId: id, depth: p.depth });
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

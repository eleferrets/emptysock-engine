/** Index constants for the built-in layers. */
export declare const LAYER: {
  readonly BACKGROUND: -1000;
  readonly DEFAULT: 0;
  readonly FOREGROUND: 100;
  readonly UI: 1000;
};
export interface LayerConfig {
  readonly name: string;
  index: number;
  visible: boolean;
}
/**
 * Opaque sort key the renderer uses to order draw calls.
 * [layerIndex, depth] — sort ascending on both fields.
 */
export type LayerSortKey = [layerIndex: number, depth: number];
export declare class LayerSystem {
  private readonly _layers;
  /** Entity id → placement. All entity IDs in the engine are numbers. */
  private readonly _placements;
  constructor();
  private _define;
  /** Define or redefine a layer. Lower index = drawn first (behind). */
  defineLayer(name: string, index: number): void;
  /**
   * Assign an entity to a layer at a specific depth.
   * depth controls draw order within the layer: lower depth = drawn first (behind).
   * Default depth is 0. Unlike GMS2, this never changes implicitly.
   */
  addEntity(entityId: number, layerName: string, depth?: number): void;
  removeEntity(entityId: number): void;
  /** Update an entity's depth within its current layer without changing the layer. */
  setDepth(entityId: number, depth: number): void;
  getEntityLayer(entityId: number): string | null;
  getEntityDepth(entityId: number): number;
  /**
   * Returns the sort key for a single entity.
   * Pass the result array into Array.sort for stable, explicit ordering:
   *   entities.sort((a, b) => {
   *     const [al, ad] = layers.getSortKey(a.id);
   *     const [bl, bd] = layers.getSortKey(b.id);
   *     return al !== bl ? al - bl : ad - bd;
   *   });
   */
  getSortKey(entityId: number): LayerSortKey;
  getLayerIndex(name: string): number;
  setVisible(name: string, visible: boolean): void;
  isVisible(name: string): boolean;
  /** Returns all entities on a given layer, sorted by depth ascending. */
  getEntitiesOnLayer(layerName: string): Array<{
    entityId: number;
    depth: number;
  }>;
  /** All layer configs sorted by index ascending (render order). */
  getLayersSorted(): LayerConfig[];
  destroy(): void;
}
//# sourceMappingURL=LayerSystem.d.ts.map

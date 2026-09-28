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
  /** Layer name → render-position offset, for `layer_x`/`layer_y`. */
  private readonly _offsets;
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
  /** True if a layer with this exact name has been defined — the real
   * backing for GameMaker's `layer_exists()` compat function
   * (`compat/gmlLayer.ts`). */
  hasLayer(name: string): boolean;
  /**
   * Set a named layer's render-position offset — the real backing for
   * GameMaker's `layer_x`/`layer_y` compat functions (`compat/gmlLayer.ts`),
   * typically used for manual parallax scrolling. A no-op for a layer that
   * hasn't been defined (`defineLayer()`/the built-in four) — matching this
   * codebase's established "no live layer/instance to even ask" honest
   * no-op convention (`QueryChannel`'s `no-live-instance`,
   * `stepGmlCameraFollow`'s no-target no-op) rather than fabricating a new
   * layer just to hold an offset nobody will ever render.
   */
  setOffset(name: string, x: number, y: number): void;
  /** A named layer's current render-position offset, `{ x: 0, y: 0 }` if
   * none was ever set — the same default an offset-free layer always had
   * before `layer_x`/`layer_y` existed. */
  getOffset(name: string): {
    x: number;
    y: number;
  };
  /** Returns all entities on a given layer, sorted by depth ascending. */
  getEntitiesOnLayer(layerName: string): Array<{
    entityId: number;
    depth: number;
  }>;
  /** All layer configs sorted by index ascending (render order). */
  getLayersSorted(): LayerConfig[];
  destroy(): void;
}

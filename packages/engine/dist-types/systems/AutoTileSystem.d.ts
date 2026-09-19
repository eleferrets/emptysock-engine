/**
 * Auto-tile rule system — selects a tile variant based on neighbour occupancy.
 *
 * A rule set is attached to a tileset. Each rule maps a neighbour bitmask
 * (8-bit: NW|N|NE|W|E|SW|S|SE) to a tile index in the tileset.
 * The painter calls resolve() with the 8-bit mask for the target cell and
 * gets back the tile index to write.
 */
export interface AutoTileRule {
  /** 8-bit neighbour mask; bit=1 means "same tile type present". Bits: 0=NW 1=N 2=NE 3=W 4=E 5=SW 6=S 7=SE */
  mask: number;
  /** Tile index (into the tileset) to use when this rule matches */
  tileIndex: number;
}
export interface AutoTileRuleSet {
  id: string;
  /** Which base tile type triggers this rule set */
  baseTileIndex: number;
  rules: AutoTileRule[];
  /** Fallback tile when no rule matches */
  defaultTileIndex: number;
}
export declare class AutoTileSystem {
  private _ruleSets;
  /** Pre-computed set of all tile indices in each ruleset for O(1) membership tests. */
  private _ruleTileIndices;
  addRuleSet(ruleSet: AutoTileRuleSet): void;
  removeRuleSet(baseTileIndex: number): void;
  getRuleSet(baseTileIndex: number): AutoTileRuleSet | undefined;
  /**
   * Resolve the correct tile variant for the cell at (col, row).
   * tileAt is a callback returning the tile index at that cell, or -1 if empty.
   */
  resolve(
    col: number,
    row: number,
    baseTileIndex: number,
    tileAt: (col: number, row: number) => number,
  ): number;
  private _sameGroup;
  /**
   * Re-resolve all cells in a layer that use this base tile type.
   * data: "col,row" -> tileIndex map (mutated in-place).
   */
  applyToLayer(data: Record<string, number>, baseTileIndex: number): void;
  private _inGroup;
  toJSON(): AutoTileRuleSet[];
  fromJSON(ruleSets: AutoTileRuleSet[]): void;
}

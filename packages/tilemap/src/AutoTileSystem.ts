/**
 * Auto-tile rule system — selects a tile variant based on neighbour occupancy.
 *
 * A rule set is attached to a tileset. Each rule maps a neighbour bitmask
 * (8-bit: NW|N|NE|W|E|SW|S|SE) to a tile index in the tileset.
 * The painter calls resolve() with the 8-bit mask for the target cell and
 * gets back the tile index to write.
 *
 * Lives in `@emptysock/tilemap`, not engine core (RELEASE_PASS.md Track 2):
 * it's pure tile-authoring/content logic with zero rendering or ECS
 * coupling (no pixi, no Scene/Entity, just plain data in and a tile index
 * out) — the same reasoning that already put `NavMeshSystem` here rather
 * than in `packages/engine`. The classic `RenderPipeline.mountTilemap()`
 * (still in engine core, since every game needs to render, not just ones
 * with tile levels) never imports this class directly; it declares its own
 * minimal `AutoTileResolver` structural interface (just the one `resolve()`
 * method it actually calls) that this class satisfies without either
 * package importing the other — the exact same pattern as `TileLayerSource`/
 * `Tilemap` (see CLAUDE.md's "RenderPipeline mounts a tilemap through a
 * structural interface" entry).
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

const DIRS: Array<{ dx: number; dy: number; bit: number }> = [
  { dx: -1, dy: -1, bit: 0 },
  { dx: 0, dy: -1, bit: 1 },
  { dx: 1, dy: -1, bit: 2 },
  { dx: -1, dy: 0, bit: 3 },
  { dx: 1, dy: 0, bit: 4 },
  { dx: -1, dy: 1, bit: 5 },
  { dx: 0, dy: 1, bit: 6 },
  { dx: 1, dy: 1, bit: 7 },
];

export class AutoTileSystem {
  private _ruleSets: Map<number, AutoTileRuleSet> = new Map();
  /** Pre-computed set of all tile indices in each ruleset for O(1) membership tests. */
  private _ruleTileIndices: Map<number, Set<number>> = new Map();

  addRuleSet(ruleSet: AutoTileRuleSet): void {
    this._ruleSets.set(ruleSet.baseTileIndex, ruleSet);
    const indices = new Set<number>();
    for (const r of ruleSet.rules) indices.add(r.tileIndex);
    this._ruleTileIndices.set(ruleSet.baseTileIndex, indices);
  }

  removeRuleSet(baseTileIndex: number): void {
    this._ruleSets.delete(baseTileIndex);
    this._ruleTileIndices.delete(baseTileIndex);
  }

  getRuleSet(baseTileIndex: number): AutoTileRuleSet | undefined {
    return this._ruleSets.get(baseTileIndex);
  }

  /**
   * Resolve the correct tile variant for the cell at (col, row).
   * tileAt is a callback returning the tile index at that cell, or -1 if empty.
   */
  resolve(
    col: number,
    row: number,
    baseTileIndex: number,
    tileAt: (col: number, row: number) => number,
  ): number {
    const rs = this._ruleSets.get(baseTileIndex);
    if (!rs) return baseTileIndex;

    let mask = 0;
    for (const d of DIRS) {
      const t = tileAt(col + d.dx, row + d.dy);
      if (t === baseTileIndex || this._sameGroup(t, rs)) {
        mask |= 1 << d.bit;
      }
    }

    for (const rule of rs.rules) {
      if ((mask & rule.mask) === rule.mask) {
        return rule.tileIndex;
      }
    }
    return rs.defaultTileIndex;
  }

  private _sameGroup(tileIndex: number, rs: AutoTileRuleSet): boolean {
    return this._ruleTileIndices.get(rs.baseTileIndex)?.has(tileIndex) ?? false;
  }

  /**
   * Re-resolve all cells in a layer that use this base tile type.
   * data: "col,row" -> tileIndex map (mutated in-place).
   */
  applyToLayer(data: Record<string, number>, baseTileIndex: number): void {
    const tileAt = (c: number, r: number): number => data[`${c},${r}`] ?? -1;

    const affected = Object.entries(data).filter(
      ([, v]) => v === baseTileIndex || this._inGroup(v, baseTileIndex),
    );
    for (const [key] of affected) {
      const parts = key.split(",").map(Number);
      const c = parts[0];
      const r = parts[1];
      if (
        c === undefined ||
        r === undefined ||
        !Number.isFinite(c) ||
        !Number.isFinite(r)
      )
        continue;
      const base = baseTileIndex;
      data[key] = this.resolve(c, r, base, tileAt);
    }
  }

  private _inGroup(tileIndex: number, baseTileIndex: number): boolean {
    return this._ruleTileIndices.get(baseTileIndex)?.has(tileIndex) ?? false;
  }

  toJSON(): AutoTileRuleSet[] {
    return Array.from(this._ruleSets.values());
  }

  fromJSON(ruleSets: AutoTileRuleSet[]): void {
    this._ruleSets.clear();
    this._ruleTileIndices.clear();
    for (const rs of ruleSets) {
      this._ruleSets.set(rs.baseTileIndex, rs);
      const indices = new Set<number>();
      for (const r of rs.rules) indices.add(r.tileIndex);
      this._ruleTileIndices.set(rs.baseTileIndex, indices);
    }
  }
}

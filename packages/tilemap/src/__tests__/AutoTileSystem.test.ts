import { describe, it, expect } from "vitest";
import { AutoTileSystem } from "../AutoTileSystem.js";
import type { AutoTileRuleSet } from "../AutoTileSystem.js";

const BASE_TILE = 1;
const ISOLATED_TILE = 2;
const EDGE_N_TILE = 3;

// A minimal rule set: no neighbours -> isolated variant; a neighbour to the
// north (bit 1) -> the "edge-north" variant; anything else -> the base tile
// itself (via defaultTileIndex).
const RULE_SET: AutoTileRuleSet = {
  id: "grass",
  baseTileIndex: BASE_TILE,
  rules: [
    { mask: 0b00000010, tileIndex: EDGE_N_TILE }, // has a north neighbour
    { mask: 0b00000000, tileIndex: ISOLATED_TILE }, // no neighbours at all
  ],
  defaultTileIndex: BASE_TILE,
};

function makeSystem(): AutoTileSystem {
  const system = new AutoTileSystem();
  system.addRuleSet(RULE_SET);
  return system;
}

describe("AutoTileSystem", () => {
  it("resolves to the base tile index when no rule set is registered for it", () => {
    const system = new AutoTileSystem();
    const result = system.resolve(0, 0, 99, () => -1);
    expect(result).toBe(99);
  });

  it("resolves to the isolated-tile rule when no neighbours match", () => {
    const system = makeSystem();
    const result = system.resolve(0, 0, BASE_TILE, () => -1);
    expect(result).toBe(ISOLATED_TILE);
  });

  it("resolves to the north-edge rule when only the north neighbour is present", () => {
    const system = makeSystem();
    const tileAt = (col: number, row: number): number =>
      col === 0 && row === -1 ? BASE_TILE : -1;
    const result = system.resolve(0, 0, BASE_TILE, tileAt);
    expect(result).toBe(EDGE_N_TILE);
  });

  it("falls back to defaultTileIndex when no rule's mask matches", () => {
    // A rule set with no rule whose mask matches (0b11111111 never equals
    // the observed mask when every neighbour is absent) exercises the
    // fallback to defaultTileIndex.
    const noMatchRuleSet: AutoTileRuleSet = {
      id: "solid",
      baseTileIndex: 5,
      rules: [{ mask: 0b11111111, tileIndex: 6 }],
      defaultTileIndex: 7,
    };
    const solo = new AutoTileSystem();
    solo.addRuleSet(noMatchRuleSet);
    const result = solo.resolve(0, 0, 5, () => -1);
    expect(result).toBe(7);
  });

  it("removeRuleSet stops resolving through that base tile's rules", () => {
    const system = makeSystem();
    system.removeRuleSet(BASE_TILE);
    const result = system.resolve(0, 0, BASE_TILE, () => -1);
    expect(result).toBe(BASE_TILE); // no rule set -> returns baseTileIndex unchanged
  });

  it("applyToLayer re-resolves every cell of the given base tile type in place", () => {
    const system = makeSystem();
    const data: Record<string, number> = {
      "0,0": BASE_TILE, // isolated
      "1,0": BASE_TILE, // has a north neighbour at 1,-1... not present, so isolated too
      "5,5": 42, // unrelated tile, must be left untouched
    };
    system.applyToLayer(data, BASE_TILE);
    expect(data["0,0"]).toBe(ISOLATED_TILE);
    expect(data["1,0"]).toBe(ISOLATED_TILE);
    expect(data["5,5"]).toBe(42);
  });

  it("toJSON/fromJSON round-trip every registered rule set", () => {
    const system = makeSystem();
    const json = system.toJSON();
    expect(json).toEqual([RULE_SET]);

    const fresh = new AutoTileSystem();
    fresh.fromJSON(json);
    expect(fresh.getRuleSet(BASE_TILE)).toEqual(RULE_SET);
  });

  it("getRuleSet returns undefined for a base tile with no rule set", () => {
    const system = new AutoTileSystem();
    expect(system.getRuleSet(999)).toBeUndefined();
  });
});

import { describe, it, expect } from "vitest";
import { applyStatusEffects, effectiveStats } from "../StatusEffects.js";
import type { CombatantState } from "../CombatantState.js";
import type { BattleEvent, StatusEffectDef } from "../BattleSystem.js";

function state(
  overrides: Partial<CombatantState> & { id: string },
): CombatantState {
  return {
    id: overrides.id,
    name: overrides.name ?? overrides.id,
    hp: overrides.hp ?? 100,
    maxHp: overrides.maxHp ?? 100,
    mp: overrides.mp ?? 0,
    maxMp: overrides.maxMp ?? 0,
    attack: overrides.attack ?? 10,
    defense: overrides.defense ?? 10,
    speed: overrides.speed ?? 0,
    luck: overrides.luck ?? 0,
    rawStats: overrides.rawStats ?? {},
    statusEffects: overrides.statusEffects ?? [],
    isParty: overrides.isParty ?? true,
    insertionOrder: overrides.insertionOrder ?? 0,
  };
}

describe("applyStatusEffects", () => {
  it("drains HP by the configured percent of max HP and emits a damage event", () => {
    const index = new Map<string, StatusEffectDef>([
      ["burn", { id: "burn", name: "Burn", hpDrainPercentPerTurn: 0.1 }],
    ]);
    const s = state({
      id: "hero",
      hp: 100,
      maxHp: 100,
      statusEffects: [{ id: "burn", name: "Burn", turnsRemaining: 3 }],
    });
    const events: BattleEvent[] = [];

    applyStatusEffects(s, index, (e) => events.push(e));

    expect(s.hp).toBe(90);
    expect(events).toContainEqual({
      kind: "damage",
      sourceId: "burn",
      targetId: "hero",
      amount: 10,
      isCrit: false,
    });
  });

  it("expires an effect once turnsRemaining reaches zero and emits status-expired", () => {
    const index = new Map<string, StatusEffectDef>([
      ["burn", { id: "burn", name: "Burn" }],
    ]);
    const s = state({
      id: "hero",
      statusEffects: [{ id: "burn", name: "Burn", turnsRemaining: 1 }],
    });
    const events: BattleEvent[] = [];

    applyStatusEffects(s, index, (e) => events.push(e));

    expect(s.statusEffects).toHaveLength(0);
    expect(events).toContainEqual({
      kind: "status-expired",
      combatantId: "hero",
      effectId: "burn",
    });
  });

  it("never decrements a permanent effect (turnsRemaining === -1)", () => {
    const index = new Map<string, StatusEffectDef>();
    const s = state({
      id: "hero",
      statusEffects: [{ id: "curse", name: "Curse", turnsRemaining: -1 }],
    });

    applyStatusEffects(s, index, () => {});

    expect(s.statusEffects).toEqual([
      { id: "curse", name: "Curse", turnsRemaining: -1 },
    ]);
  });

  it("emits combatant-defeated when drain brings hp to 0", () => {
    const index = new Map<string, StatusEffectDef>([
      ["burn", { id: "burn", name: "Burn", hpDrainPercentPerTurn: 1 }],
    ]);
    const s = state({
      id: "hero",
      hp: 10,
      maxHp: 10,
      statusEffects: [{ id: "burn", name: "Burn", turnsRemaining: 3 }],
    });
    const events: BattleEvent[] = [];

    applyStatusEffects(s, index, (e) => events.push(e));

    expect(s.hp).toBe(0);
    expect(events).toContainEqual({
      kind: "combatant-defeated",
      combatantId: "hero",
    });
  });
});

describe("effectiveStats", () => {
  it("multiplies attack/defense by active status effect multipliers", () => {
    const index = new Map<string, StatusEffectDef>([
      ["weaken", { id: "weaken", name: "Weaken", attackMultiplier: 0.5 }],
      ["guard", { id: "guard", name: "Guard", defenseMultiplier: 2 }],
    ]);
    const s = state({
      id: "hero",
      attack: 20,
      defense: 10,
      statusEffects: [
        { id: "weaken", name: "Weaken", turnsRemaining: -1 },
        { id: "guard", name: "Guard", turnsRemaining: -1 },
      ],
    });

    expect(effectiveStats(s, index)).toEqual({ attack: 10, defense: 20 });
  });

  it("returns raw stats unchanged when there are no active effects", () => {
    const s = state({ id: "hero", attack: 15, defense: 5 });
    expect(effectiveStats(s, new Map())).toEqual({ attack: 15, defense: 5 });
  });
});

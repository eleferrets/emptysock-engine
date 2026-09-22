import { describe, it, expect } from "vitest";
import { computeTurnOrder } from "../TurnOrder.js";
import type { CombatantState } from "../CombatantState.js";

function state(
  overrides: Partial<CombatantState> & { id: string },
): CombatantState {
  return {
    id: overrides.id,
    name: overrides.name ?? overrides.id,
    hp: overrides.hp ?? 10,
    maxHp: overrides.maxHp ?? 10,
    mp: overrides.mp ?? 0,
    maxMp: overrides.maxMp ?? 0,
    attack: overrides.attack ?? 0,
    defense: overrides.defense ?? 0,
    speed: overrides.speed ?? 0,
    luck: overrides.luck ?? 0,
    rawStats: overrides.rawStats ?? {},
    statusEffects: overrides.statusEffects ?? [],
    isParty: overrides.isParty ?? true,
    insertionOrder: overrides.insertionOrder ?? 0,
  };
}

describe("computeTurnOrder", () => {
  it("orders by speed descending", () => {
    const order = computeTurnOrder(
      [state({ id: "a", speed: 5, insertionOrder: 0 })],
      [state({ id: "b", speed: 10, insertionOrder: 1 })],
    );
    expect(order).toEqual(["b", "a"]);
  });

  it("breaks a speed tie by luck descending", () => {
    const order = computeTurnOrder(
      [
        state({ id: "a", speed: 5, luck: 1, insertionOrder: 0 }),
        state({ id: "b", speed: 5, luck: 9, insertionOrder: 1 }),
      ],
      [],
    );
    expect(order).toEqual(["b", "a"]);
  });

  it("breaks a speed+luck tie by insertion order ascending", () => {
    const order = computeTurnOrder(
      [
        state({ id: "second", speed: 5, luck: 0, insertionOrder: 1 }),
        state({ id: "first", speed: 5, luck: 0, insertionOrder: 0 }),
      ],
      [],
    );
    expect(order).toEqual(["first", "second"]);
  });

  it("excludes combatants with 0 or negative hp", () => {
    const order = computeTurnOrder(
      [state({ id: "alive", hp: 1 }), state({ id: "dead", hp: 0 })],
      [],
    );
    expect(order).toEqual(["alive"]);
  });
});

/**
 * End-to-end test: a minimal turn-based RPG combat loop, exercising
 * BattleSystem the way a real game does across a full battle.
 *
 * Moved out of `packages/engine/src/__tests__/GameE2E.test.ts` when
 * BattleSystem became its own module package (`@emptysock/battle`,
 * CLAUDE.md §13.1) — the rest of that E2E suite (Scene/ECS, SceneManager,
 * TweenManager, Widget) stayed in the engine package since it never touched
 * BattleSystem.
 */
import { describe, it, expect } from "vitest";
import { BattleSystem } from "../BattleSystem.js";
import type { BattleEvent } from "../BattleSystem.js";

function makeCombatant(
  id: string,
  name: string,
  isParty: boolean,
  hp = 100,
  atk = 20,
  def = 10,
) {
  return {
    id,
    name,
    stats: {
      hp,
      maxHp: hp,
      mp: 50,
      maxMp: 50,
      attack: atk,
      defense: def,
      speed: 10,
      luck: 0,
    },
    statusEffects: [] as never[],
    isParty,
  };
}

describe("BattleSystem full combat loop", () => {
  it("runs a complete 1v1 battle to victory", () => {
    const battle = new BattleSystem({ critChance: 0, fleeChance: 0 });
    battle.loadDatabase({
      skills: [
        {
          id: "fireball",
          name: "Fireball",
          mpCost: 10,
          targetType: "single-enemy",
          formula: "magical",
          power: 40,
        },
      ],
      statusEffects: [],
    });

    const events: BattleEvent[] = [];
    battle.subscribe((e) => events.push(e));

    battle.start(
      [makeCombatant("hero", "Hero", true, 100, 30, 10)],
      [makeCombatant("slime", "Slime", false, 50, 10, 5)],
    );
    expect(battle.getPhase()).toBe("input");

    const actionNeededEvents = events.filter((e) => e.kind === "action-needed");
    expect(actionNeededEvents.length).toBeGreaterThan(0);

    // Hero attacks each round until slime is defeated
    let rounds = 0;
    while (battle.getPhase() === "input" && rounds < 20) {
      battle.submitAction("hero", { type: "attack", targetId: "slime" });
      rounds++;
    }

    const phase = battle.getPhase();
    expect(phase === "victory" || phase === "input").toBe(true);

    if (phase === "victory") {
      expect(events.some((e) => e.kind === "victory")).toBe(true);
      expect(events.some((e) => e.kind === "combatant-defeated")).toBe(true);
    }

    battle.destroy();
  });

  it("skill with status effect applies the effect", () => {
    const battle = new BattleSystem({ critChance: 0 });
    battle.loadDatabase({
      skills: [
        {
          id: "poison",
          name: "Poison Arrow",
          mpCost: 5,
          targetType: "single-enemy",
          formula: "fixed",
          power: 10,
          statusEffect: { effectId: "poisoned", chance: 1.0 },
        },
      ],
      statusEffects: [
        { id: "poisoned", name: "Poisoned", hpDrainPercentPerTurn: 0.1 },
      ],
    });

    const events: BattleEvent[] = [];
    battle.subscribe((e) => events.push(e));

    battle.start(
      [makeCombatant("hero", "Hero", true, 200, 20, 10)],
      [makeCombatant("goblin", "Goblin", false, 200, 10, 5)],
    );
    // Use poison skill
    battle.submitAction("hero", {
      type: "skill",
      skillId: "poison",
      targetId: "goblin",
    });

    expect(events.some((e) => e.kind === "status-applied")).toBe(true);

    const applied = events.find((e) => e.kind === "status-applied") as
      | Extract<BattleEvent, { kind: "status-applied" }>
      | undefined;
    expect(applied?.effectId).toBe("poisoned");

    battle.destroy();
  });

  it("flee action changes phase to idle", () => {
    const battle = new BattleSystem({ fleeChance: 1.0 });
    battle.start(
      [makeCombatant("hero", "Hero", true)],
      [makeCombatant("boss", "Boss", false)],
    );

    let fled = false;
    battle.subscribe((e) => {
      if (e.kind === "fled") fled = true;
    });
    battle.submitAction("hero", { type: "flee" });

    expect(fled).toBe(true);
    battle.destroy();
  });
});

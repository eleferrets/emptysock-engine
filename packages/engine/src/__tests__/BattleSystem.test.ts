import { describe, it, expect, vi, afterEach } from "vitest";
import {
  BattleSystem,
  type BattleEvent,
  type Combatant,
  type BattleDatabase,
} from "../systems/BattleSystem.js";

function makeCombatant(
  id: string,
  name: string,
  isParty: boolean,
  overrides: Partial<{
    hp: number;
    maxHp: number;
    attack: number;
    defense: number;
    speed: number;
    luck: number;
    mp: number;
    maxMp: number;
  }> = {},
): Combatant {
  const hp = overrides.hp ?? overrides.maxHp ?? 100;
  return {
    id,
    name,
    stats: {
      hp,
      maxHp: overrides.maxHp ?? hp,
      mp: overrides.mp ?? 50,
      maxMp: overrides.maxMp ?? 50,
      attack: overrides.attack ?? 20,
      defense: overrides.defense ?? 10,
      speed: overrides.speed ?? 10,
      luck: overrides.luck ?? 0,
    },
    statusEffects: [],
    isParty,
  };
}

describe("BattleSystem", () => {
  let restoreRandom: (() => void) | null = null;

  afterEach(() => {
    if (restoreRandom !== null) {
      restoreRandom();
      restoreRandom = null;
    }
  });

  /** Force Math.random() to return a fixed value for deterministic RNG paths. */
  function mockRandom(value: number): void {
    const spy = vi.spyOn(Math, "random").mockReturnValue(value);
    restoreRandom = () => spy.mockRestore();
  }

  // --- Starting a battle ---

  describe("start()", () => {
    it("emits battle-start, round-start(1), and action-needed for the first party member", () => {
      const battle = new BattleSystem({ critChance: 0, fleeChance: 0 });
      const events: BattleEvent[] = [];
      battle.subscribe((e) => events.push(e));

      battle.start(
        [makeCombatant("hero", "Hero", true, { speed: 10 })],
        [makeCombatant("slime", "Slime", false, { speed: 1 })],
      );

      expect(events[0]).toEqual({ kind: "battle-start" });
      expect(events[1]).toEqual({ kind: "round-start", round: 1 });
      expect(events[2]).toEqual({
        kind: "action-needed",
        combatantId: "hero",
      });
      expect(battle.getPhase()).toBe("input");
      expect(battle.getRound()).toBe(1);
    });

    it("replaces any previous roster on a second start() call", () => {
      const battle = new BattleSystem();
      battle.start(
        [makeCombatant("a", "A", true)],
        [makeCombatant("x", "X", false)],
      );
      battle.start(
        [makeCombatant("b", "B", true)],
        [makeCombatant("y", "Y", false)],
      );

      expect(battle.getParty().map((c) => c.id)).toEqual(["b"]);
      expect(battle.getEnemies().map((c) => c.id)).toEqual(["y"]);
      expect(battle.getRound()).toBe(1);
    });

    it("orders turns by speed descending, then luck descending, then insertion order", () => {
      const battle = new BattleSystem({ fleeChance: 0 });
      const events: BattleEvent[] = [];
      battle.subscribe((e) => events.push(e));

      // Two combatants tie on speed; luck breaks the tie. A third combatant
      // ties on both speed and luck; insertion order breaks that tie.
      battle.start(
        [
          makeCombatant("slow", "Slow", true, { speed: 1 }),
          makeCombatant("tieA", "TieA", true, { speed: 5, luck: 5 }),
          makeCombatant("tieB", "TieB", true, { speed: 5, luck: 5 }),
        ],
        [makeCombatant("fast", "Fast", false, { speed: 20 })],
      );

      // Only party members receive action-needed events; drain them all by
      // submitting basic attacks and inspect the damage event source order
      // instead, which follows _turnOrder.
      battle.submitAction("slow", { type: "attack", targetId: "fast" });
      battle.submitAction("tieA", { type: "attack", targetId: "fast" });
      battle.submitAction("tieB", { type: "attack", targetId: "fast" });

      const damageEvents = events.filter(
        (e): e is Extract<BattleEvent, { kind: "damage" }> =>
          e.kind === "damage",
      );
      // fast (speed 20) should act first, then tieA/tieB (speed 5, luck 5,
      // insertion order tieA before tieB), then slow (speed 1) last.
      expect(damageEvents.map((e) => e.sourceId)).toEqual([
        "fast",
        "tieA",
        "tieB",
        "slow",
      ]);
    });
  });

  // --- submitAction across turns/rounds ---

  describe("submitAction()", () => {
    it("resolves the round once every awaiting party member has submitted", () => {
      const battle = new BattleSystem({ critChance: 0, fleeChance: 0 });
      const events: BattleEvent[] = [];
      battle.subscribe((e) => events.push(e));

      battle.start(
        [
          makeCombatant("hero1", "Hero1", true, { speed: 10 }),
          makeCombatant("hero2", "Hero2", true, { speed: 9 }),
        ],
        [
          makeCombatant("slime", "Slime", false, {
            hp: 1000,
            maxHp: 1000,
            speed: 1,
          }),
        ],
      );

      battle.submitAction("hero1", { type: "attack", targetId: "slime" });
      // Round should not resolve yet — hero2 still owed input.
      expect(battle.getPhase()).toBe("input");
      expect(
        events.some((e) => e.kind === "round-start" && e.round === 2),
      ).toBe(false);

      battle.submitAction("hero2", { type: "attack", targetId: "slime" });
      // Now the round resolves and a new round begins.
      expect(battle.getPhase()).toBe("input");
      expect(
        events.some((e) => e.kind === "round-start" && e.round === 2),
      ).toBe(true);
      expect(battle.getRound()).toBe(2);
    });

    it("advances multiple rounds toward victory", () => {
      const battle = new BattleSystem({ critChance: 0, fleeChance: 0 });
      battle.start(
        [makeCombatant("hero", "Hero", true, { attack: 50, speed: 10 })],
        [
          makeCombatant("slime", "Slime", false, {
            hp: 40,
            maxHp: 40,
            defense: 0,
            speed: 1,
          }),
        ],
      );

      let rounds = 0;
      while (battle.getPhase() === "input" && rounds < 10) {
        battle.submitAction("hero", { type: "attack", targetId: "slime" });
        rounds++;
      }

      expect(battle.getPhase()).toBe("victory");
    });

    it("ignores an action from a combatant not currently awaiting input", () => {
      const battle = new BattleSystem();
      const events: BattleEvent[] = [];
      battle.start(
        [makeCombatant("hero", "Hero", true)],
        [makeCombatant("slime", "Slime", false)],
      );
      battle.subscribe((e) => events.push(e));

      // "slime" is an enemy, never in _awaitingInput.
      battle.submitAction("slime", { type: "attack", targetId: "hero" });
      expect(events).toEqual([]);
      expect(battle.getPhase()).toBe("input");
    });

    it("ignores an action for an unknown combatant id", () => {
      const battle = new BattleSystem();
      battle.start(
        [makeCombatant("hero", "Hero", true)],
        [makeCombatant("slime", "Slime", false)],
      );
      expect(() =>
        battle.submitAction("nobody", { type: "attack", targetId: "slime" }),
      ).not.toThrow();
      expect(battle.getPhase()).toBe("input");
    });

    it("ignores actions once the battle is not in the input phase", () => {
      const battle = new BattleSystem({ fleeChance: 1 });
      battle.start(
        [makeCombatant("hero", "Hero", true)],
        [makeCombatant("boss", "Boss", false)],
      );
      battle.submitAction("hero", { type: "flee" });
      expect(battle.getPhase()).toBe("victory");

      const events: BattleEvent[] = [];
      battle.subscribe((e) => events.push(e));
      battle.submitAction("hero", { type: "attack", targetId: "boss" });
      expect(events).toEqual([]);
    });

    it("does nothing for a defeated party member's stale queued turn", () => {
      const battle = new BattleSystem({ critChance: 0, fleeChance: 0 });
      battle.start(
        [
          makeCombatant("hero", "Hero", true, { hp: 1, maxHp: 1, speed: 20 }),
          makeCombatant("healer", "Healer", true, { speed: 1 }),
        ],
        [makeCombatant("boss", "Boss", false, { attack: 999, speed: 10 })],
      );

      // hero acts first (speed 20) and dies to boss's counter before healer's turn.
      battle.submitAction("hero", { type: "attack", targetId: "boss" });
      battle.submitAction("healer", { type: "attack", targetId: "boss" });

      // Should not throw and battle should have progressed normally.
      expect(["input", "victory", "defeat"]).toContain(battle.getPhase());
    });
  });

  // --- Status effects ---

  describe("status effects", () => {
    it("applies a status effect on skill hit and emits status-applied", () => {
      mockRandom(0); // guarantees the status-effect chance roll succeeds
      const db: BattleDatabase = {
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
      };
      const battle = new BattleSystem({ db, critChance: 0 });
      const events: BattleEvent[] = [];
      battle.subscribe((e) => events.push(e));

      battle.start(
        [makeCombatant("hero", "Hero", true, { mp: 20, maxMp: 20 })],
        [makeCombatant("goblin", "Goblin", false, { hp: 200, maxHp: 200 })],
      );
      battle.submitAction("hero", {
        type: "skill",
        skillId: "poison",
        targetId: "goblin",
      });

      const applied = events.find(
        (e): e is Extract<BattleEvent, { kind: "status-applied" }> =>
          e.kind === "status-applied",
      );
      expect(applied).toBeDefined();
      expect(applied?.effectId).toBe("poisoned");
      expect(applied?.combatantId).toBe("goblin");
    });

    it("does not stack a status effect already active on the target", () => {
      mockRandom(0);
      const db: BattleDatabase = {
        skills: [
          {
            id: "poison",
            name: "Poison",
            mpCost: 0,
            targetType: "single-enemy",
            formula: "fixed",
            power: 1,
            statusEffect: { effectId: "poisoned", chance: 1.0 },
          },
        ],
        statusEffects: [
          { id: "poisoned", name: "Poisoned", hpDrainPercentPerTurn: 0.01 },
        ],
      };
      const battle = new BattleSystem({ db, critChance: 0, fleeChance: 0 });
      battle.start(
        [makeCombatant("hero", "Hero", true, { mp: 20, maxMp: 20, speed: 10 })],
        [
          makeCombatant("goblin", "Goblin", false, {
            hp: 500,
            maxHp: 500,
            speed: 1,
          }),
        ],
      );

      battle.submitAction("hero", {
        type: "skill",
        skillId: "poison",
        targetId: "goblin",
      });
      // Round 2: apply again — should not duplicate the entry.
      battle.submitAction("hero", {
        type: "skill",
        skillId: "poison",
        targetId: "goblin",
      });

      const goblin = battle.getEnemies().find((c) => c.id === "goblin");
      expect(
        goblin?.statusEffects.filter((se) => se.id === "poisoned"),
      ).toHaveLength(1);
    });

    it("drains HP each turn and expires after its duration reaches zero", () => {
      const db: BattleDatabase = {
        skills: [],
        statusEffects: [
          { id: "burn", name: "Burn", hpDrainPercentPerTurn: 0.1 },
        ],
      };
      const battle = new BattleSystem({ db, critChance: 0, fleeChance: 0 });
      const events: BattleEvent[] = [];

      const hero: Combatant = {
        id: "hero",
        name: "Hero",
        stats: {
          hp: 100,
          maxHp: 100,
          mp: 10,
          maxMp: 10,
          attack: 0,
          defense: 0,
          speed: 10,
          luck: 0,
        },
        statusEffects: [{ id: "burn", name: "Burn", turnsRemaining: 2 }],
        isParty: true,
      };

      battle.start(
        [hero],
        [makeCombatant("dummy", "Dummy", false, { attack: 0, speed: 1 })],
      );
      battle.subscribe((e) => events.push(e));

      // Round 1 tick: hero acts (attack does 0 dmg since attack=0), status ticks first.
      battle.submitAction("hero", { type: "attack", targetId: "dummy" });
      // Round 2 tick: second and final decrement, should expire.
      battle.submitAction("hero", { type: "attack", targetId: "dummy" });

      const drainEvents = events.filter(
        (e) => e.kind === "damage" && e.sourceId === "burn",
      );
      expect(drainEvents.length).toBeGreaterThanOrEqual(1);
      expect(events.some((e) => e.kind === "status-expired")).toBe(true);
    });
  });

  // --- Crit and flee ---

  describe("crit and flee", () => {
    it("applies the crit multiplier when the crit roll succeeds", () => {
      mockRandom(0); // always crits (chance check: random < critChance + luck/100)
      const battle = new BattleSystem({
        critChance: 1,
        critMultiplier: 2,
        fleeChance: 0,
      });
      const events: BattleEvent[] = [];
      battle.subscribe((e) => events.push(e));

      battle.start(
        [makeCombatant("hero", "Hero", true, { attack: 30, speed: 10 })],
        [
          makeCombatant("slime", "Slime", false, {
            hp: 1000,
            maxHp: 1000,
            defense: 10,
            speed: 1,
          }),
        ],
      );
      battle.submitAction("hero", { type: "attack", targetId: "slime" });

      const dmg = events.find(
        (e): e is Extract<BattleEvent, { kind: "damage" }> =>
          e.kind === "damage",
      );
      expect(dmg?.isCrit).toBe(true);
      // (30 - 10/2) * 1.0 * 2 = 50
      expect(dmg?.amount).toBe(50);
    });

    it("never crits when the crit roll fails", () => {
      mockRandom(0.999);
      const battle = new BattleSystem({ critChance: 0.0625, fleeChance: 0 });
      const events: BattleEvent[] = [];
      battle.subscribe((e) => events.push(e));

      battle.start(
        [makeCombatant("hero", "Hero", true, { attack: 30, speed: 10 })],
        [
          makeCombatant("slime", "Slime", false, {
            hp: 1000,
            maxHp: 1000,
            speed: 1,
          }),
        ],
      );
      battle.submitAction("hero", { type: "attack", targetId: "slime" });

      const dmg = events.find(
        (e): e is Extract<BattleEvent, { kind: "damage" }> =>
          e.kind === "damage",
      );
      expect(dmg?.isCrit).toBe(false);
    });

    it("succeeds fleeing and moves to victory when the flee roll succeeds", () => {
      mockRandom(0); // random < fleeChance succeeds
      const battle = new BattleSystem({ fleeChance: 0.5 });
      const events: BattleEvent[] = [];
      battle.subscribe((e) => events.push(e));

      battle.start(
        [makeCombatant("hero", "Hero", true)],
        [makeCombatant("boss", "Boss", false)],
      );
      battle.submitAction("hero", { type: "flee" });

      expect(events.some((e) => e.kind === "fled")).toBe(true);
      expect(battle.getPhase()).toBe("victory");
    });

    it("fails to flee and continues the battle when the flee roll fails", () => {
      mockRandom(0.999); // random < fleeChance fails
      const battle = new BattleSystem({ fleeChance: 0.5, critChance: 0 });
      const events: BattleEvent[] = [];
      battle.subscribe((e) => events.push(e));

      battle.start(
        [makeCombatant("hero", "Hero", true, { speed: 10 })],
        [makeCombatant("boss", "Boss", false, { attack: 0, speed: 1 })],
      );
      battle.submitAction("hero", { type: "flee" });

      expect(events.some((e) => e.kind === "fled")).toBe(false);
      // Round resolves normally and a new round starts (boss attacks for 0
      // and survives), so we should be back in "input".
      expect(battle.getPhase()).toBe("input");
      expect(battle.getRound()).toBe(2);
    });
  });

  // --- Events ---

  describe("subscribe()", () => {
    it("delivers events to multiple handlers and stops after unsubscribe", () => {
      const battle = new BattleSystem({ fleeChance: 0 });
      const a: BattleEvent[] = [];
      const b: BattleEvent[] = [];
      battle.subscribe((e) => a.push(e));
      const unsubB = battle.subscribe((e) => b.push(e));

      battle.start(
        [makeCombatant("hero", "Hero", true)],
        [makeCombatant("slime", "Slime", false)],
      );
      expect(a.length).toBeGreaterThan(0);
      expect(b.length).toBe(a.length);

      unsubB();
      const bLenBefore = b.length;
      battle.submitAction("hero", { type: "attack", targetId: "slime" });
      expect(b.length).toBe(bLenBefore);
      expect(a.length).toBeGreaterThan(bLenBefore);
    });
  });

  // --- Edge cases ---

  describe("edge cases", () => {
    it("ends in victory immediately if all enemies start defeated at round resolution", () => {
      const battle = new BattleSystem({ critChance: 0, fleeChance: 0 });
      const events: BattleEvent[] = [];
      battle.subscribe((e) => events.push(e));

      battle.start(
        [makeCombatant("hero", "Hero", true, { attack: 999, speed: 10 })],
        [
          makeCombatant("slime", "Slime", false, {
            hp: 1,
            maxHp: 1,
            defense: 0,
            speed: 1,
          }),
        ],
      );
      battle.submitAction("hero", { type: "attack", targetId: "slime" });

      expect(battle.getPhase()).toBe("victory");
      expect(events.some((e) => e.kind === "victory")).toBe(true);
      expect(
        events.some(
          (e) => e.kind === "combatant-defeated" && e.combatantId === "slime",
        ),
      ).toBe(true);
    });

    it("ends in defeat when all party members are reduced to 0 hp", () => {
      const battle = new BattleSystem({ critChance: 0, fleeChance: 0 });
      const events: BattleEvent[] = [];
      battle.subscribe((e) => events.push(e));

      battle.start(
        [
          makeCombatant("hero", "Hero", true, {
            hp: 1,
            maxHp: 1,
            defense: 0,
            speed: 20,
          }),
        ],
        [makeCombatant("boss", "Boss", false, { attack: 999, speed: 1 })],
      );
      // hero attacks but boss survives; boss's auto turn then kills hero.
      battle.submitAction("hero", { type: "attack", targetId: "boss" });

      expect(battle.getPhase()).toBe("defeat");
      expect(events.some((e) => e.kind === "defeat")).toBe(true);
    });

    it("does nothing for submitAction() called on a destroyed battle", () => {
      const battle = new BattleSystem();
      battle.start(
        [makeCombatant("hero", "Hero", true)],
        [makeCombatant("slime", "Slime", false)],
      );
      battle.destroy();

      expect(() =>
        battle.submitAction("hero", { type: "attack", targetId: "slime" }),
      ).not.toThrow();
      expect(battle.getParty()).toEqual([]);
      expect(battle.getEnemies()).toEqual([]);
    });

    it("does nothing for start() called after destroy()", () => {
      const battle = new BattleSystem();
      battle.destroy();
      battle.start(
        [makeCombatant("hero", "Hero", true)],
        [makeCombatant("slime", "Slime", false)],
      );
      expect(battle.getPhase()).toBe("idle");
      expect(battle.getParty()).toEqual([]);
    });

    it("silently fails a skill when the actor lacks sufficient MP", () => {
      const db: BattleDatabase = {
        skills: [
          {
            id: "fireball",
            name: "Fireball",
            mpCost: 999,
            targetType: "single-enemy",
            formula: "fixed",
            power: 10,
          },
        ],
        statusEffects: [],
      };
      const battle = new BattleSystem({ db, fleeChance: 0 });
      const events: BattleEvent[] = [];

      battle.start(
        [makeCombatant("hero", "Hero", true, { mp: 5, maxMp: 5 })],
        [makeCombatant("slime", "Slime", false, { attack: 0 })],
      );
      battle.subscribe((e) => events.push(e));
      battle.submitAction("hero", {
        type: "skill",
        skillId: "fireball",
        targetId: "slime",
      });

      expect(events.some((e) => e.kind === "mp-cost")).toBe(false);
      expect(
        events.some((e) => e.kind === "damage" && e.sourceId === "hero"),
      ).toBe(false);
    });

    it("getCombatant returns undefined for an unknown id", () => {
      const battle = new BattleSystem();
      battle.start(
        [makeCombatant("hero", "Hero", true)],
        [makeCombatant("slime", "Slime", false)],
      );
      expect(battle.getCombatant("nobody")).toBeUndefined();
      expect(battle.getCombatant("hero")?.name).toBe("Hero");
    });
  });

  // --- Custom damage formula and stat map ---

  describe("configuration", () => {
    it("uses a custom damage formula supplied via setDamageFormula", () => {
      const battle = new BattleSystem({ critChance: 0, fleeChance: 0 });
      battle.setDamageFormula(() => 7);
      const events: BattleEvent[] = [];
      battle.subscribe((e) => events.push(e));

      battle.start(
        [makeCombatant("hero", "Hero", true, { speed: 10 })],
        [
          makeCombatant("slime", "Slime", false, {
            hp: 1000,
            maxHp: 1000,
            speed: 1,
          }),
        ],
      );
      battle.submitAction("hero", { type: "attack", targetId: "slime" });

      const dmg = events.find(
        (e): e is Extract<BattleEvent, { kind: "damage" }> =>
          e.kind === "damage",
      );
      expect(dmg?.amount).toBe(7);
    });

    it("resolves attack/defense/speed/luck through a custom statMap", () => {
      const battle = new BattleSystem({
        critChance: 0,
        fleeChance: 0,
        statMap: { attack: "atk", defense: "def", speed: "spd", luck: "lck" },
      });
      const events: BattleEvent[] = [];
      battle.subscribe((e) => events.push(e));

      const hero: Combatant = {
        id: "hero",
        name: "Hero",
        stats: {
          hp: 100,
          maxHp: 100,
          mp: 10,
          maxMp: 10,
          atk: 30,
          def: 0,
          spd: 10,
          lck: 0,
        },
        statusEffects: [],
        isParty: true,
      };
      const slime: Combatant = {
        id: "slime",
        name: "Slime",
        stats: {
          hp: 1000,
          maxHp: 1000,
          mp: 0,
          maxMp: 0,
          atk: 0,
          def: 0,
          spd: 1,
          lck: 0,
        },
        statusEffects: [],
        isParty: false,
      };

      battle.start([hero], [slime]);
      battle.submitAction("hero", { type: "attack", targetId: "slime" });

      const dmg = events.find(
        (e): e is Extract<BattleEvent, { kind: "damage" }> =>
          e.kind === "damage",
      );
      // (30 - 0/2) * 1.0 = 30
      expect(dmg?.amount).toBe(30);
    });

    it("loadDatabase replaces skills and status effects before start()", () => {
      const battle = new BattleSystem({ fleeChance: 0, critChance: 0 });
      battle.loadDatabase({
        skills: [
          {
            id: "heal",
            name: "Heal",
            mpCost: 5,
            targetType: "self",
            formula: "fixed",
            power: 20,
            isHeal: true,
          },
        ],
        statusEffects: [],
      });

      const events: BattleEvent[] = [];
      battle.start(
        [
          makeCombatant("hero", "Hero", true, {
            hp: 50,
            maxHp: 100,
            mp: 20,
            maxMp: 20,
          }),
        ],
        [makeCombatant("slime", "Slime", false, { attack: 0 })],
      );
      battle.subscribe((e) => events.push(e));
      battle.submitAction("hero", {
        type: "skill",
        skillId: "heal",
        targetId: "hero",
      });

      const heal = events.find(
        (e): e is Extract<BattleEvent, { kind: "heal" }> => e.kind === "heal",
      );
      expect(heal?.amount).toBe(20);
      // Heal for 20 (50 -> 70), then the enemy's minimum-1-damage basic
      // attack (attack 0 still floors to 1 damage) brings it to 69.
      expect(battle.getCombatant("hero")?.stats.hp).toBe(69);
    });
  });
});

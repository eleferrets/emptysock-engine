import { describe, it, expect, vi, afterEach } from "vitest";
import {
  DEFAULT_PHYSICAL,
  executeAction,
  executeSkill,
  resolveTargets,
  type DamageResolutionContext,
} from "../DamageResolution.js";
import type { CombatantState } from "../CombatantState.js";
import type { BattleEvent, Combatant, SkillDef } from "../BattleSystem.js";

function state(
  overrides: Partial<CombatantState> & { id: string },
): CombatantState {
  return {
    id: overrides.id,
    name: overrides.name ?? overrides.id,
    hp: overrides.hp ?? 100,
    maxHp: overrides.maxHp ?? 100,
    mp: overrides.mp ?? 50,
    maxMp: overrides.maxMp ?? 50,
    attack: overrides.attack ?? 20,
    defense: overrides.defense ?? 10,
    speed: overrides.speed ?? 10,
    luck: overrides.luck ?? 0,
    rawStats: overrides.rawStats ?? {},
    statusEffects: overrides.statusEffects ?? [],
    isParty: overrides.isParty ?? true,
    insertionOrder: overrides.insertionOrder ?? 0,
  };
}

function toSnapshot(s: CombatantState): Combatant {
  return {
    id: s.id,
    name: s.name,
    stats: {
      hp: s.hp,
      maxHp: s.maxHp,
      mp: s.mp,
      maxMp: s.maxMp,
      ...s.rawStats,
    },
    statusEffects: s.statusEffects,
    isParty: s.isParty,
  };
}

function makeContext(
  party: CombatantState[],
  enemies: CombatantState[],
  events: BattleEvent[],
  overrides: Partial<DamageResolutionContext> = {},
): DamageResolutionContext {
  return {
    party: new Map(party.map((s) => [s.id, s])),
    enemies: new Map(enemies.map((s) => [s.id, s])),
    statusEffectIndex: new Map(),
    skillIndex: new Map(),
    toSnapshot,
    emit: (e) => events.push(e),
    critChance: 0,
    critMultiplier: 1.5,
    fleeChance: 0.5,
    physicalFormula: DEFAULT_PHYSICAL,
    onFlee: () => {},
    ...overrides,
  };
}

describe("DEFAULT_PHYSICAL", () => {
  it("floors (attack - defense/2) * power, minimum 1", () => {
    const amount = DEFAULT_PHYSICAL({
      attacker: {} as Combatant,
      target: {} as Combatant,
      effectiveAttack: 30,
      effectiveDefense: 10,
      power: 1,
      isCrit: false,
      critMultiplier: 2,
    });
    expect(amount).toBe(25);
  });

  it("never returns less than 1", () => {
    const amount = DEFAULT_PHYSICAL({
      attacker: {} as Combatant,
      target: {} as Combatant,
      effectiveAttack: 1,
      effectiveDefense: 1000,
      power: 1,
      isCrit: false,
      critMultiplier: 2,
    });
    expect(amount).toBe(1);
  });

  it("applies the crit multiplier when isCrit is true", () => {
    const amount = DEFAULT_PHYSICAL({
      attacker: {} as Combatant,
      target: {} as Combatant,
      effectiveAttack: 30,
      effectiveDefense: 10,
      power: 1,
      isCrit: true,
      critMultiplier: 2,
    });
    expect(amount).toBe(50);
  });
});

describe("resolveTargets", () => {
  const party = [state({ id: "hero", isParty: true })];
  const enemies = [
    state({ id: "goblin", isParty: false }),
    state({ id: "orc", isParty: false }),
  ];
  const partyMap = new Map(party.map((s) => [s.id, s]));
  const enemyMap = new Map(enemies.map((s) => [s.id, s]));
  const hero = party[0] as CombatantState;

  it("single-enemy resolves the named enemy for a party actor", () => {
    const targets = resolveTargets(
      hero,
      "single-enemy",
      "goblin",
      partyMap,
      enemyMap,
    );
    expect(targets.map((t) => t.id)).toEqual(["goblin"]);
  });

  it("all-enemies resolves every living enemy", () => {
    const targets = resolveTargets(
      hero,
      "all-enemies",
      "goblin",
      partyMap,
      enemyMap,
    );
    expect(targets.map((t) => t.id).sort()).toEqual(["goblin", "orc"]);
  });

  it("self resolves the actor only", () => {
    const targets = resolveTargets(hero, "self", "hero", partyMap, enemyMap);
    expect(targets.map((t) => t.id)).toEqual(["hero"]);
  });

  it("excludes a defeated target", () => {
    const deadEnemy = state({ id: "dead", isParty: false, hp: 0 });
    const targets = resolveTargets(
      hero,
      "single-enemy",
      "dead",
      partyMap,
      new Map([["dead", deadEnemy]]),
    );
    expect(targets).toEqual([]);
  });
});

describe("executeAction", () => {
  afterEach(() => vi.restoreAllMocks());

  it("attack applies the physical formula and emits a damage event", () => {
    const events: BattleEvent[] = [];
    const hero = state({ id: "hero", attack: 30, isParty: true });
    const slime = state({ id: "slime", defense: 10, isParty: false });
    const ctx = makeContext([hero], [slime], events);

    executeAction(ctx, hero, { type: "attack", targetId: "slime" });

    const dmg = events.find((e) => e.kind === "damage");
    expect(dmg).toMatchObject({ sourceId: "hero", targetId: "slime" });
    expect(slime.hp).toBeLessThan(slime.maxHp);
  });

  it("attack against an unknown or defeated target is a no-op", () => {
    const events: BattleEvent[] = [];
    const hero = state({ id: "hero", isParty: true });
    const ctx = makeContext([hero], [], events);

    expect(() =>
      executeAction(ctx, hero, { type: "attack", targetId: "ghost" }),
    ).not.toThrow();
    expect(events).toEqual([]);
  });

  it("flee emits 'fled' and calls onFlee when the roll succeeds", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const events: BattleEvent[] = [];
    const onFlee = vi.fn();
    const hero = state({ id: "hero", isParty: true });
    const ctx = makeContext([hero], [], events, { fleeChance: 1, onFlee });

    executeAction(ctx, hero, { type: "flee" });

    expect(events).toContainEqual({ kind: "fled" });
    expect(onFlee).toHaveBeenCalledOnce();
  });

  it("flee does nothing when the roll fails", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const events: BattleEvent[] = [];
    const onFlee = vi.fn();
    const hero = state({ id: "hero", isParty: true });
    const ctx = makeContext([hero], [], events, { fleeChance: 0.5, onFlee });

    executeAction(ctx, hero, { type: "flee" });

    expect(events).toEqual([]);
    expect(onFlee).not.toHaveBeenCalled();
  });

  it("skill action dispatches to executeSkill (insufficient MP is a silent no-op)", () => {
    const events: BattleEvent[] = [];
    const skill: SkillDef = {
      id: "fireball",
      name: "Fireball",
      mpCost: 999,
      targetType: "single-enemy",
      formula: "fixed",
      power: 10,
    };
    const hero = state({ id: "hero", mp: 5, isParty: true });
    const slime = state({ id: "slime", isParty: false });
    const ctx = makeContext([hero], [slime], events, {
      skillIndex: new Map([["fireball", skill]]),
    });

    executeAction(ctx, hero, {
      type: "skill",
      skillId: "fireball",
      targetId: "slime",
    });

    expect(events).toEqual([]);
    expect(hero.mp).toBe(5);
  });
});

describe("executeSkill", () => {
  it("deducts MP, emits mp-cost, and applies a heal for isHeal skills", () => {
    const events: BattleEvent[] = [];
    const skill: SkillDef = {
      id: "heal",
      name: "Heal",
      mpCost: 5,
      targetType: "self",
      formula: "fixed",
      power: 20,
      isHeal: true,
    };
    const hero = state({
      id: "hero",
      hp: 50,
      maxHp: 100,
      mp: 20,
      isParty: true,
    });
    const ctx = makeContext([hero], [], events, {
      skillIndex: new Map([["heal", skill]]),
    });

    executeSkill(ctx, hero, "heal", "hero");

    expect(hero.mp).toBe(15);
    expect(hero.hp).toBe(70);
    expect(events).toContainEqual({
      kind: "mp-cost",
      combatantId: "hero",
      amount: 5,
    });
    expect(events).toContainEqual({
      kind: "heal",
      sourceId: "hero",
      targetId: "hero",
      amount: 20,
    });
  });

  it("percent-max-hp formula deals a fraction of the target's max hp", () => {
    const events: BattleEvent[] = [];
    const skill: SkillDef = {
      id: "quake",
      name: "Quake",
      mpCost: 0,
      targetType: "single-enemy",
      formula: "percent-max-hp",
      power: 0.5,
    };
    const hero = state({ id: "hero", isParty: true });
    const slime = state({ id: "slime", hp: 200, maxHp: 200, isParty: false });
    const ctx = makeContext([hero], [slime], events, {
      skillIndex: new Map([["quake", skill]]),
    });

    executeSkill(ctx, hero, "quake", "slime");

    expect(slime.hp).toBe(100);
  });

  it("unknown skill id is a silent no-op", () => {
    const events: BattleEvent[] = [];
    const hero = state({ id: "hero", isParty: true });
    const ctx = makeContext([hero], [], events);

    expect(() =>
      executeSkill(ctx, hero, "does-not-exist", "hero"),
    ).not.toThrow();
    expect(events).toEqual([]);
  });
});

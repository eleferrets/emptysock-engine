import type {
  BattleAction,
  BattleEvent,
  Combatant,
  DamageContext,
  SkillDef,
  StatusEffectDef,
} from "./BattleSystem.js";
import type { CombatantState } from "./CombatantState.js";
import { effectiveStats } from "./StatusEffects.js";

export const DEFAULT_PHYSICAL = (ctx: DamageContext): number =>
  Math.max(
    1,
    Math.floor(
      (ctx.effectiveAttack - ctx.effectiveDefense / 2) *
        ctx.power *
        (ctx.isCrit ? ctx.critMultiplier : 1),
    ),
  );

/**
 * Dependencies `executeAction`/`executeSkill` need from `BattleSystem` but
 * don't own themselves: combatant lookup, the public-snapshot converter, the
 * event sink, the configured formula/rates, and the definition indexes.
 */
export interface DamageResolutionContext {
  party: ReadonlyMap<string, CombatantState>;
  enemies: ReadonlyMap<string, CombatantState>;
  statusEffectIndex: ReadonlyMap<string, StatusEffectDef>;
  skillIndex: ReadonlyMap<string, SkillDef>;
  toSnapshot: (state: CombatantState) => Combatant;
  emit: (event: BattleEvent) => void;
  critChance: number;
  critMultiplier: number;
  fleeChance: number;
  physicalFormula: (ctx: DamageContext) => number;
  onFlee: () => void;
}

function rollCrit(luck: number, critChance: number): boolean {
  return Math.random() < critChance + luck / 100;
}

function applyDamage(
  emit: (event: BattleEvent) => void,
  sourceId: string,
  target: CombatantState,
  amount: number,
  isCrit: boolean,
): void {
  target.hp = Math.max(0, target.hp - amount);
  emit({ kind: "damage", sourceId, targetId: target.id, amount, isCrit });
  if (target.hp <= 0) {
    emit({ kind: "combatant-defeated", combatantId: target.id });
  }
}

function applyHeal(
  emit: (event: BattleEvent) => void,
  sourceId: string,
  target: CombatantState,
  amount: number,
): void {
  target.hp = Math.min(target.maxHp, target.hp + amount);
  emit({ kind: "heal", sourceId, targetId: target.id, amount });
}

/**
 * Resolves the combatants a skill with `targetType` hits, given the actor and
 * the primary (player-chosen, or auto-chosen for enemies) target id.
 */
export function resolveTargets(
  actor: CombatantState,
  targetType: SkillDef["targetType"],
  primaryTargetId: string,
  party: ReadonlyMap<string, CombatantState>,
  enemies: ReadonlyMap<string, CombatantState>,
): CombatantState[] {
  switch (targetType) {
    case "single-enemy": {
      const map = actor.isParty ? enemies : party;
      const t = map.get(primaryTargetId);
      return t !== undefined && t.hp > 0 ? [t] : [];
    }
    case "all-enemies": {
      const map = actor.isParty ? enemies : party;
      return Array.from(map.values()).filter((s) => s.hp > 0);
    }
    case "single-ally": {
      const map = actor.isParty ? party : enemies;
      const t = map.get(primaryTargetId);
      return t !== undefined && t.hp > 0 ? [t] : [];
    }
    case "all-allies": {
      const map = actor.isParty ? party : enemies;
      return Array.from(map.values()).filter((s) => s.hp > 0);
    }
    case "self": {
      return actor.hp > 0 ? [actor] : [];
    }
  }
}

/** Executes an `attack` or `flee` action, or dispatches a `skill` action to `executeSkill`. */
export function executeAction(
  ctx: DamageResolutionContext,
  actor: CombatantState,
  action: BattleAction,
): void {
  if (action.type === "flee") {
    if (Math.random() < ctx.fleeChance) {
      ctx.emit({ kind: "fled" });
      ctx.onFlee();
    }
    return;
  }

  if (action.type === "attack") {
    const target =
      ctx.party.get(action.targetId) ?? ctx.enemies.get(action.targetId);
    if (target === undefined || target.hp <= 0) return;

    const actEff = effectiveStats(actor, ctx.statusEffectIndex);
    const tgtEff = effectiveStats(target, ctx.statusEffectIndex);
    const isCrit = rollCrit(actor.luck, ctx.critChance);
    const dmg = ctx.physicalFormula({
      attacker: ctx.toSnapshot(actor),
      target: ctx.toSnapshot(target),
      effectiveAttack: actEff.attack,
      effectiveDefense: tgtEff.defense,
      power: 1.0,
      isCrit,
      critMultiplier: ctx.critMultiplier,
    });
    applyDamage(ctx.emit, actor.id, target, dmg, isCrit);
    return;
  }

  // action.type === 'skill'
  executeSkill(ctx, actor, action.skillId, action.targetId);
}

/** Executes a skill: MP cost, target resolution, per-target damage/heal formula, status-effect chance roll. */
export function executeSkill(
  ctx: DamageResolutionContext,
  actor: CombatantState,
  skillId: string,
  primaryTargetId: string,
): void {
  const skill = ctx.skillIndex.get(skillId);
  if (skill === undefined) return;

  // Insufficient MP — fail silently, no event
  if (actor.mp < skill.mpCost) return;

  actor.mp -= skill.mpCost;
  ctx.emit({ kind: "mp-cost", combatantId: actor.id, amount: skill.mpCost });

  const targets = resolveTargets(
    actor,
    skill.targetType,
    primaryTargetId,
    ctx.party,
    ctx.enemies,
  );
  const actEff = effectiveStats(actor, ctx.statusEffectIndex);

  for (const target of targets) {
    if (target.hp <= 0) continue;

    let amount = 0;
    let isCrit = false;

    switch (skill.formula) {
      case "physical": {
        isCrit = rollCrit(actor.luck, ctx.critChance);
        const tgtEff = effectiveStats(target, ctx.statusEffectIndex);
        amount = ctx.physicalFormula({
          attacker: ctx.toSnapshot(actor),
          target: ctx.toSnapshot(target),
          effectiveAttack: actEff.attack,
          effectiveDefense: tgtEff.defense,
          power: skill.power,
          isCrit,
          critMultiplier: ctx.critMultiplier,
        });
        break;
      }
      case "magical": {
        isCrit = rollCrit(actor.luck, ctx.critChance);
        const tgtEff = effectiveStats(target, ctx.statusEffectIndex);
        amount = Math.max(
          1,
          Math.floor(
            (actEff.attack * 1.5 - tgtEff.defense * 0.5) *
              skill.power *
              (isCrit ? ctx.critMultiplier : 1),
          ),
        );
        break;
      }
      case "fixed": {
        amount = Math.floor(skill.power);
        break;
      }
      case "percent-max-hp": {
        amount = Math.floor(target.maxHp * skill.power);
        break;
      }
      default: {
        amount = 0;
      }
    }

    if (skill.isHeal === true) {
      applyHeal(ctx.emit, actor.id, target, amount);
    } else {
      applyDamage(ctx.emit, actor.id, target, amount, isCrit);
    }

    // Apply status effect if the target is still standing
    const seSpec = skill.statusEffect;
    if (
      seSpec !== undefined &&
      target.hp > 0 &&
      Math.random() < seSpec.chance
    ) {
      const seDef = ctx.statusEffectIndex.get(seSpec.effectId);
      if (seDef !== undefined) {
        const alreadyActive = target.statusEffects.some(
          (se) => se.id === seDef.id,
        );
        if (!alreadyActive) {
          target.statusEffects.push({
            id: seDef.id,
            name: seDef.name,
            turnsRemaining: -1,
          });
        }
        ctx.emit({
          kind: "status-applied",
          combatantId: target.id,
          effectId: seDef.id,
          name: seDef.name,
        });
      }
    }
  }
}

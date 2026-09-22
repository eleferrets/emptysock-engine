import type { BattleEvent, StatusEffectDef } from "./BattleSystem.js";
import type { CombatantState } from "./CombatantState.js";

/**
 * Ticks every status effect on `state` for one round: applies HP drain (if
 * any), decrements duration, and removes/emits `status-expired` for any
 * effect that just ran out. Mutates `state` in place. `emit` is the same
 * event sink `BattleSystem` hands its subscribers.
 */
export function applyStatusEffects(
  state: CombatantState,
  statusEffectIndex: ReadonlyMap<string, StatusEffectDef>,
  emit: (event: BattleEvent) => void,
): void {
  const toExpire: string[] = [];

  // Iterate over a copy so removal mid-loop is safe
  for (const se of [...state.statusEffects]) {
    const def = statusEffectIndex.get(se.id);

    // HP drain
    if (
      state.hp > 0 &&
      def !== undefined &&
      def.hpDrainPercentPerTurn !== undefined &&
      def.hpDrainPercentPerTurn > 0
    ) {
      const drain = Math.floor(state.maxHp * def.hpDrainPercentPerTurn);
      state.hp = Math.max(0, state.hp - drain);
      emit({
        kind: "damage",
        sourceId: se.id,
        targetId: state.id,
        amount: drain,
        isCrit: false,
      });
      if (state.hp <= 0) {
        emit({ kind: "combatant-defeated", combatantId: state.id });
      }
    }

    // Decrement duration
    if (se.turnsRemaining !== -1) {
      se.turnsRemaining--;
      if (se.turnsRemaining <= 0) {
        toExpire.push(se.id);
      }
    }
  }

  for (const effectId of toExpire) {
    state.statusEffects = state.statusEffects.filter(
      (se) => se.id !== effectId,
    );
    emit({ kind: "status-expired", combatantId: state.id, effectId });
  }
}

/**
 * Resolves `state`'s attack/defense after applying every active status
 * effect's multiplier (multiplicatively, in whatever order the effects are
 * stored).
 */
export function effectiveStats(
  state: CombatantState,
  statusEffectIndex: ReadonlyMap<string, StatusEffectDef>,
): { attack: number; defense: number } {
  let atkMult = 1;
  let defMult = 1;

  for (const se of state.statusEffects) {
    const def = statusEffectIndex.get(se.id);
    if (def === undefined) continue;
    if (def.attackMultiplier !== undefined) atkMult *= def.attackMultiplier;
    if (def.defenseMultiplier !== undefined) defMult *= def.defenseMultiplier;
  }

  return {
    attack: state.attack * atkMult,
    defense: state.defense * defMult,
  };
}

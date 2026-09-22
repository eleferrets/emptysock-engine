import type { StatusEffect } from "./BattleSystem.js";

/**
 * Internal mutable combatant record. Not part of the public API — `BattleSystem`
 * converts to/from the public, frozen `Combatant` snapshot via `toState`/`toSnapshot`.
 * Shared by `TurnOrder.ts`, `StatusEffects.ts`, and `DamageResolution.ts` so none of
 * them need to reach back into `BattleSystem.ts` for this shape.
 */
export interface CombatantState {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  attack: number; // resolved from statMap
  defense: number;
  speed: number;
  luck: number;
  rawStats: Record<string, number>; // original stats for snapshot reconstruction
  statusEffects: StatusEffect[];
  isParty: boolean;
  insertionOrder: number;
}

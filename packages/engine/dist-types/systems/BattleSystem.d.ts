export type BattlePhase = "idle" | "input" | "resolving" | "victory" | "defeat";
/**
 * Stat block for a combatant. `hp`, `maxHp`, `mp`, `maxMp` are required and
 * drive battle lifecycle. Any additional numeric field is valid — define your
 * own stat names (`atk`, `str`, `agility`, …) and tell BattleSystem which key
 * to treat as attack/defense/speed/luck via `BattleSystemOptions.statMap`.
 */
export type BattleStats = {
  readonly hp: number;
  readonly maxHp: number;
  readonly mp: number;
  readonly maxMp: number;
} & Record<string, number>;
export interface StatusEffect {
  id: string;
  name: string;
  turnsRemaining: number;
}
export interface Combatant {
  id: string;
  name: string;
  stats: BattleStats;
  statusEffects: readonly StatusEffect[];
  isParty: boolean;
}
export type SkillTargetType =
  | "single-enemy"
  | "all-enemies"
  | "single-ally"
  | "all-allies"
  | "self";
export type DamageFormulaId =
  | "physical"
  | "magical"
  | "fixed"
  | "percent-max-hp";
export interface SkillDef {
  id: string;
  name: string;
  mpCost: number;
  targetType: SkillTargetType;
  formula: DamageFormulaId;
  power: number;
  isHeal?: boolean;
  statusEffect?: {
    effectId: string;
    chance: number;
  };
}
export interface StatusEffectDef {
  id: string;
  name: string;
  hpDrainPercentPerTurn?: number;
  attackMultiplier?: number;
  defenseMultiplier?: number;
}
export interface BattleDatabase {
  skills: SkillDef[];
  statusEffects: StatusEffectDef[];
}
export type BattleAction =
  | {
      type: "attack";
      targetId: string;
    }
  | {
      type: "skill";
      skillId: string;
      targetId: string;
    }
  | {
      type: "flee";
    };
export type BattleEvent =
  | {
      kind: "battle-start";
    }
  | {
      kind: "round-start";
      round: number;
    }
  | {
      kind: "action-needed";
      combatantId: string;
    }
  | {
      kind: "damage";
      sourceId: string;
      targetId: string;
      amount: number;
      isCrit: boolean;
    }
  | {
      kind: "heal";
      sourceId: string;
      targetId: string;
      amount: number;
    }
  | {
      kind: "mp-cost";
      combatantId: string;
      amount: number;
    }
  | {
      kind: "status-applied";
      combatantId: string;
      effectId: string;
      name: string;
    }
  | {
      kind: "status-expired";
      combatantId: string;
      effectId: string;
    }
  | {
      kind: "combatant-defeated";
      combatantId: string;
    }
  | {
      kind: "victory";
    }
  | {
      kind: "defeat";
    }
  | {
      kind: "fled";
    };
/**
 * Maps logical stat roles to the key names in your BattleStats objects.
 * All fields are optional and default to the canonical name ('attack', etc.).
 *
 * @example
 * // Use abbreviations:
 * statMap: { attack: 'atk', defense: 'def', speed: 'spd', luck: 'lck' }
 *
 * // Use a fully custom stat name as attack power:
 * statMap: { attack: 'spellPower' }
 */
export interface BattleStatMap {
  /** Stat key used as attack power. Default: 'attack'. */
  attack?: string;
  /** Stat key used as defense. Default: 'defense'. */
  defense?: string;
  /** Stat key used for turn order. Default: 'speed'. */
  speed?: string;
  /** Stat key added to crit chance. Default: 'luck'. */
  luck?: string;
}
/**
 * Context passed to a custom damage formula set via `setDamageFormula()`.
 * `effectiveAttack` and `effectiveDefense` already incorporate status
 * multipliers. Access `attacker.stats` and `target.stats` for any custom stat.
 */
export interface DamageContext {
  readonly attacker: Combatant;
  readonly target: Combatant;
  /** Attacker's attack stat after status multipliers. */
  readonly effectiveAttack: number;
  /** Target's defense stat after status multipliers. */
  readonly effectiveDefense: number;
  readonly power: number;
  readonly isCrit: boolean;
  readonly critMultiplier: number;
}
export interface BattleSystemOptions {
  db?: BattleDatabase;
  critChance?: number;
  critMultiplier?: number;
  fleeChance?: number;
  /**
   * Map logical stat roles to the key names used in your BattleStats objects.
   * Lets you use custom or abbreviated names without losing built-in turn
   * ordering, crit, and formula behaviour.
   */
  statMap?: BattleStatMap;
}
/**
 * Turn-based RPG combat engine. Owns combatant state, turn order, damage
 * formulas, status-effect resolution, and the input/resolving/victory/defeat
 * phase machine. It emits `BattleEvent`s for the caller to render; it has no
 * renderer of its own.
 *
 * Public surface is intentionally narrow:
 * - `start()` begins a battle from a party and enemy roster.
 * - `submitAction()` is the only way to advance an in-progress battle.
 * - `subscribe()` is the only way to observe what happened.
 * - The `get*` queries are read-only snapshots.
 *
 * Turn order, formula application, and status-effect resolution are fully
 * internal — there is no public API for stepping through them piecemeal.
 */
export declare class BattleSystem {
  private readonly _critChance;
  private readonly _critMultiplier;
  private readonly _fleeChance;
  private readonly _statMap;
  private _db;
  private _statusEffectIndex;
  private _skillIndex;
  private _phase;
  private _getPhase;
  private _setPhase;
  private _round;
  private _destroyed;
  private readonly _party;
  private readonly _enemies;
  private _insertionCounter;
  private readonly _handlers;
  private readonly _pendingActions;
  private _awaitingInput;
  private _turnOrder;
  private _physicalFormula;
  constructor(options?: BattleSystemOptions);
  /** Load skill and status effect definitions. Call before `start()`. */
  loadDatabase(db: BattleDatabase): void;
  /**
   * Replace the physical damage formula. Called with a `DamageContext` that
   * exposes status-adjusted attack/defense and full combatant snapshots (for
   * any custom stat access). Return the final integer damage amount.
   *
   * @example
   * battle.setDamageFormula((ctx) => {
   *   const magicPower = ctx.attacker.stats['magic'] ?? 0;
   *   return Math.max(1, Math.floor(magicPower * ctx.power - ctx.effectiveDefense / 4));
   * });
   */
  setDamageFormula(fn: (ctx: DamageContext) => number): void;
  /** Subscribe to battle events. Returns an unsubscribe function. */
  subscribe(handler: (event: BattleEvent) => void): () => void;
  /**
   * Begin a battle with the given party and enemy roster. Replaces any
   * previous roster. Emits `'battle-start'`, then `'round-start'`, then
   * `'action-needed'` for the first party member in turn order.
   */
  start(party: readonly Combatant[], enemies: readonly Combatant[]): void;
  /**
   * Submit an action for a party member. Once every party member awaiting
   * input has submitted, the round resolves automatically: enemies act,
   * status effects tick, and either the next round begins or the battle
   * ends in victory/defeat.
   */
  submitAction(combatantId: string, action: BattleAction): void;
  getPhase(): BattlePhase;
  getRound(): number;
  getCombatant(id: string): Combatant | undefined;
  getParty(): Combatant[];
  getEnemies(): Combatant[];
  destroy(): void;
  private _toState;
  private _toSnapshot;
  private _emit;
  private _computeTurnOrder;
  private _beginInputPhase;
  private _autoChooseEnemyActions;
  private _resolveRound;
  private _applyStatusEffects;
  private _effectiveStats;
  private _rollCrit;
  private _applyDamage;
  private _applyHeal;
  private _executeAction;
  private _resolveTargets;
  private _executeSkill;
  private _checkEndConditions;
}

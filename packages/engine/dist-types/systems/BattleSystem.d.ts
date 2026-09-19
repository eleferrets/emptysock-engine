export type BattlePhase = "idle" | "input" | "resolving" | "victory" | "defeat";
export interface BattleStats {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  attack: number;
  defense: number;
  speed: number;
  luck: number;
}
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
export interface BattleSystemOptions {
  db?: BattleDatabase;
  critChance?: number;
  critMultiplier?: number;
  fleeChance?: number;
}
export declare class BattleSystem {
  private readonly _critChance;
  private readonly _critMultiplier;
  private readonly _fleeChance;
  private _db;
  private _skillMap;
  private _statusEffectMap;
  private _phase;
  private _readPhase;
  private _round;
  private _destroyed;
  private readonly _party;
  private readonly _enemies;
  private _aliveParty;
  private _aliveEnemies;
  private _insertionCounter;
  private readonly _handlers;
  private readonly _pendingActions;
  private _awaitingInput;
  private _turnOrder;
  private _physicalFormula;
  constructor(options?: BattleSystemOptions);
  addPartyMember(combatant: Combatant): void;
  addEnemy(combatant: Combatant): void;
  loadDatabase(db: BattleDatabase): void;
  setDamageFormula(
    fn: (
      atk: number,
      def: number,
      power: number,
      isCrit: boolean,
      critMultiplier: number,
    ) => number,
  ): void;
  onEvent(handler: (event: BattleEvent) => void): () => void;
  start(): void;
  submitAction(combatantId: string, action: BattleAction): void;
  getPhase(): BattlePhase;
  getCombatant(id: string): Combatant | undefined;
  getParty(): readonly Combatant[];
  getEnemies(): readonly Combatant[];
  getRound(): number;
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

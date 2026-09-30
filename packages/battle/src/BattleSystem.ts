import type { CombatantState } from "./CombatantState.js";
import { computeTurnOrder } from "./TurnOrder.js";
import { applyStatusEffects } from "./StatusEffects.js";
import {
  DEFAULT_PHYSICAL,
  executeAction,
  type DamageResolutionContext,
} from "./DamageResolution.js";

// --- Public types ---

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
  turnsRemaining: number; // -1 = permanent until removed
}

export interface Combatant {
  id: string;
  name: string;
  stats: BattleStats;
  statusEffects: readonly StatusEffect[];
  isParty: boolean;
}

export type SkillTargetType =
  "single-enemy" | "all-enemies" | "single-ally" | "all-allies" | "self";

export type DamageFormulaId =
  "physical" | "magical" | "fixed" | "percent-max-hp";

export interface SkillDef {
  id: string;
  name: string;
  mpCost: number;
  targetType: SkillTargetType;
  formula: DamageFormulaId;
  power: number;
  isHeal?: boolean;
  statusEffect?: { effectId: string; chance: number };
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
  | { type: "attack"; targetId: string }
  | { type: "skill"; skillId: string; targetId: string }
  | { type: "flee" };

export type BattleEvent =
  | { kind: "battle-start" }
  | { kind: "round-start"; round: number }
  | { kind: "action-needed"; combatantId: string }
  | {
      kind: "damage";
      sourceId: string;
      targetId: string;
      amount: number;
      isCrit: boolean;
    }
  | { kind: "heal"; sourceId: string; targetId: string; amount: number }
  | { kind: "mp-cost"; combatantId: string; amount: number }
  | {
      kind: "status-applied";
      combatantId: string;
      effectId: string;
      name: string;
    }
  | { kind: "status-expired"; combatantId: string; effectId: string }
  | { kind: "combatant-defeated"; combatantId: string }
  | { kind: "victory" }
  | { kind: "defeat" }
  | { kind: "fled" };

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

// --- BattleSystem ---

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
export class BattleSystem {
  private readonly _critChance: number;
  private readonly _critMultiplier: number;
  private readonly _fleeChance: number;
  private readonly _statMap: Required<BattleStatMap>;

  private _db: BattleDatabase;
  private _statusEffectIndex: Map<string, StatusEffectDef> = new Map();
  private _skillIndex: Map<string, SkillDef> = new Map();

  // `_phase` is read exclusively through `_getPhase()`. TypeScript's
  // control-flow narrowing caches a class field's literal type across an
  // entire method body, including after calls to other private methods that
  // reassign it (e.g. `_checkEndConditions()` setting "victory" mid-loop).
  // Routing every read through a method call — which the compiler never
  // narrows across — keeps every phase comparison honest instead of
  // silently comparing against a stale cached literal.
  private _phase: BattlePhase = "idle";
  private _getPhase(): BattlePhase {
    return this._phase;
  }
  private _setPhase(phase: BattlePhase): void {
    this._phase = phase;
  }

  private _round = 0;
  private _destroyed = false;

  private readonly _party = new Map<string, CombatantState>();
  private readonly _enemies = new Map<string, CombatantState>();
  private _insertionCounter = 0;

  private readonly _handlers = new Set<(event: BattleEvent) => void>();
  private readonly _pendingActions = new Map<string, BattleAction>();

  // Party member ids waiting for input this round, in turn order
  private _awaitingInput: string[] = [];
  // All combatant ids for the current round, sorted by speed desc
  private _turnOrder: string[] = [];

  private _physicalFormula: (ctx: DamageContext) => number = DEFAULT_PHYSICAL;

  constructor(options?: BattleSystemOptions) {
    this._critChance = options?.critChance ?? 0.0625;
    this._critMultiplier = options?.critMultiplier ?? 1.5;
    this._fleeChance = options?.fleeChance ?? 0.5;
    this._db = options?.db ?? { skills: [], statusEffects: [] };
    this._statusEffectIndex = new Map(
      this._db.statusEffects.map((d) => [d.id, d]),
    );
    this._skillIndex = new Map(this._db.skills.map((s) => [s.id, s]));
    this._statMap = {
      attack: options?.statMap?.attack ?? "attack",
      defense: options?.statMap?.defense ?? "defense",
      speed: options?.statMap?.speed ?? "speed",
      luck: options?.statMap?.luck ?? "luck",
    };
  }

  // --- Configuration (call before start()) ---

  /** Load skill and status effect definitions. Call before `start()`. */
  loadDatabase(db: BattleDatabase): void {
    this._db = db;
    this._statusEffectIndex = new Map(db.statusEffects.map((d) => [d.id, d]));
    this._skillIndex = new Map(db.skills.map((s) => [s.id, s]));
  }

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
  setDamageFormula(fn: (ctx: DamageContext) => number): void {
    this._physicalFormula = fn;
  }

  // --- Events ---

  /** Subscribe to battle events. Returns an unsubscribe function. */
  subscribe(handler: (event: BattleEvent) => void): () => void {
    this._handlers.add(handler);
    return () => {
      this._handlers.delete(handler);
    };
  }

  // --- Battle lifecycle ---

  /**
   * Begin a battle with the given party and enemy roster. Replaces any
   * previous roster. Emits `'battle-start'`, then `'round-start'`, then
   * `'action-needed'` for the first party member in turn order.
   */
  start(party: readonly Combatant[], enemies: readonly Combatant[]): void {
    if (this._destroyed) return;

    this._party.clear();
    this._enemies.clear();
    for (const c of party) this._party.set(c.id, this._toState(c));
    for (const c of enemies) this._enemies.set(c.id, this._toState(c));

    this._round = 1;
    this._setPhase("input");
    this._pendingActions.clear();
    this._computeTurnOrder();
    this._emit({ kind: "battle-start" });
    this._emit({ kind: "round-start", round: this._round });
    this._beginInputPhase();
  }

  /**
   * Submit an action for a party member. Once every party member awaiting
   * input has submitted, the round resolves automatically: enemies act,
   * status effects tick, and either the next round begins or the battle
   * ends in victory/defeat.
   */
  submitAction(combatantId: string, action: BattleAction): void {
    if (this._destroyed || this._getPhase() !== "input") return;

    const state = this._party.get(combatantId);
    if (state === undefined || state.hp <= 0) return;

    const idx = this._awaitingInput.indexOf(combatantId);
    if (idx === -1) return;

    this._pendingActions.set(combatantId, action);
    this._awaitingInput.splice(idx, 1);

    if (this._awaitingInput.length > 0) {
      const nextId = this._awaitingInput[0];
      if (nextId !== undefined) {
        this._emit({ kind: "action-needed", combatantId: nextId });
      }
    } else {
      this._autoChooseEnemyActions();
      this._resolveRound();
    }
  }

  // --- Read-only queries ---

  getPhase(): BattlePhase {
    return this._getPhase();
  }
  getRound(): number {
    return this._round;
  }

  getCombatant(id: string): Combatant | undefined {
    const s = this._party.get(id) ?? this._enemies.get(id);
    return s !== undefined ? this._toSnapshot(s) : undefined;
  }

  getParty(): Combatant[] {
    return Array.from(this._party.values()).map((s) => this._toSnapshot(s));
  }

  getEnemies(): Combatant[] {
    return Array.from(this._enemies.values()).map((s) => this._toSnapshot(s));
  }

  destroy(): void {
    this._destroyed = true;
    this._party.clear();
    this._enemies.clear();
    this._handlers.clear();
    this._pendingActions.clear();
  }

  // --- Private helpers ---

  private _toState(c: Combatant): CombatantState {
    const raw = c.stats as Record<string, number>;
    return {
      id: c.id,
      name: c.name,
      hp: c.stats.hp,
      maxHp: c.stats.maxHp,
      mp: c.stats.mp,
      maxMp: c.stats.maxMp,
      attack: raw[this._statMap.attack] ?? 0,
      defense: raw[this._statMap.defense] ?? 0,
      speed: raw[this._statMap.speed] ?? 0,
      luck: raw[this._statMap.luck] ?? 0,
      rawStats: { ...raw },
      statusEffects: c.statusEffects.map((se) => ({ ...se })),
      isParty: c.isParty,
      insertionOrder: this._insertionCounter++,
    };
  }

  private _toSnapshot(state: CombatantState): Combatant {
    // Reconstruct from rawStats so custom stat fields are preserved in snapshots.
    const stats: Record<string, number> = {
      ...state.rawStats,
      hp: state.hp,
      maxHp: state.maxHp,
      mp: state.mp,
      maxMp: state.maxMp,
    };
    return Object.freeze({
      id: state.id,
      name: state.name,
      stats: Object.freeze(stats) as BattleStats,
      statusEffects: Object.freeze(
        state.statusEffects.map((se) => Object.freeze<StatusEffect>({ ...se })),
      ),
      isParty: state.isParty,
    }) as Combatant;
  }

  private _emit(event: BattleEvent): void {
    for (const handler of this._handlers) {
      handler(event);
    }
  }

  private _computeTurnOrder(): void {
    this._turnOrder = computeTurnOrder(
      this._party.values(),
      this._enemies.values(),
    );
  }

  private _beginInputPhase(): void {
    this._awaitingInput = this._turnOrder.filter((id) => {
      const s = this._party.get(id);
      return s !== undefined && s.hp > 0;
    });

    if (this._awaitingInput.length === 0) {
      this._autoChooseEnemyActions();
      this._resolveRound();
      return;
    }

    const firstId = this._awaitingInput[0];
    if (firstId !== undefined) {
      this._emit({ kind: "action-needed", combatantId: firstId });
    }
  }

  private _autoChooseEnemyActions(): void {
    for (const enemy of this._enemies.values()) {
      if (enemy.hp <= 0) continue;

      let lowestHp = Infinity;
      let targetId: string | undefined;

      for (const member of this._party.values()) {
        if (member.hp > 0 && member.hp < lowestHp) {
          lowestHp = member.hp;
          targetId = member.id;
        }
      }

      if (targetId !== undefined) {
        this._pendingActions.set(enemy.id, { type: "attack", targetId });
      }
    }
  }

  private _resolveRound(): void {
    this._setPhase("resolving");

    for (const id of this._turnOrder) {
      if (this._getPhase() !== "resolving") break;

      const state = this._party.get(id) ?? this._enemies.get(id);
      if (state === undefined || state.hp <= 0) continue;

      // Apply status effects before this combatant acts
      applyStatusEffects(state, this._statusEffectIndex, (e) => this._emit(e));
      if (this._checkEndConditions()) break;
      if (state.hp <= 0) continue;

      // Execute the queued action
      const action = this._pendingActions.get(id);
      if (action !== undefined) {
        this._executeAction(state, action);
      }
      if (this._checkEndConditions()) break;
    }

    this._pendingActions.clear();

    if (this._getPhase() === "resolving") {
      // Begin the next round
      this._round++;
      this._setPhase("input");
      this._computeTurnOrder();
      this._emit({ kind: "round-start", round: this._round });
      this._beginInputPhase();
    }
  }

  private _damageResolutionContext(): DamageResolutionContext {
    return {
      party: this._party,
      enemies: this._enemies,
      statusEffectIndex: this._statusEffectIndex,
      skillIndex: this._skillIndex,
      toSnapshot: (state) => this._toSnapshot(state),
      emit: (event) => this._emit(event),
      critChance: this._critChance,
      critMultiplier: this._critMultiplier,
      fleeChance: this._fleeChance,
      physicalFormula: this._physicalFormula,
      onFlee: () => this._setPhase("victory"),
    };
  }

  private _executeAction(actor: CombatantState, action: BattleAction): void {
    executeAction(this._damageResolutionContext(), actor, action);
  }

  private _checkEndConditions(): boolean {
    const allEnemiesDead = Array.from(this._enemies.values()).every(
      (s) => s.hp <= 0,
    );
    if (allEnemiesDead) {
      this._emit({ kind: "victory" });
      this._setPhase("victory");
      return true;
    }

    const allPartyDead = Array.from(this._party.values()).every(
      (s) => s.hp <= 0,
    );
    if (allPartyDead) {
      this._emit({ kind: "defeat" });
      this._setPhase("defeat");
      return true;
    }

    return false;
  }
}

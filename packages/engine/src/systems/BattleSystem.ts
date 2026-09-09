// --- Public types ---

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

export interface BattleSystemOptions {
  db?: BattleDatabase;
  critChance?: number;
  critMultiplier?: number;
  fleeChance?: number;
}

// --- Internal ---

interface _CombatantState {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  attack: number;
  defense: number;
  speed: number;
  luck: number;
  statusEffects: StatusEffect[];
  isParty: boolean;
  insertionOrder: number;
}

type _PhysicalFormula = (
  atk: number,
  def: number,
  power: number,
  isCrit: boolean,
  critMultiplier: number,
) => number;

const DEFAULT_PHYSICAL: _PhysicalFormula = (
  atk,
  def,
  power,
  isCrit,
  critMult,
) => Math.max(1, Math.floor((atk - def / 2) * power * (isCrit ? critMult : 1)));

// --- BattleSystem ---

export class BattleSystem {
  private readonly _critChance: number;
  private readonly _critMultiplier: number;
  private readonly _fleeChance: number;

  private _db: BattleDatabase;
  private _phase: BattlePhase = "idle";
  // Indirection prevents TypeScript from narrowing _phase within callers that
  // assign it and then call methods that can mutate it (e.g. _checkEndConditions).
  private _readPhase(): BattlePhase {
    return this._phase;
  }
  private _round = 0;
  private _destroyed = false;

  private readonly _party = new Map<string, _CombatantState>();
  private readonly _enemies = new Map<string, _CombatantState>();
  private _insertionCounter = 0;

  private readonly _handlers = new Set<(event: BattleEvent) => void>();
  private readonly _pendingActions = new Map<string, BattleAction>();

  // Party member ids waiting for input this round, in turn order
  private _awaitingInput: string[] = [];
  // All combatant ids for the current round, sorted by speed desc
  private _turnOrder: string[] = [];

  private _physicalFormula: _PhysicalFormula = DEFAULT_PHYSICAL;

  constructor(options?: BattleSystemOptions) {
    this._critChance = options?.critChance ?? 0.0625;
    this._critMultiplier = options?.critMultiplier ?? 1.5;
    this._fleeChance = options?.fleeChance ?? 0.5;
    this._db = options?.db ?? { skills: [], statusEffects: [] };
  }

  // --- Setup ---

  addPartyMember(combatant: Combatant): void {
    this._party.set(combatant.id, this._toState(combatant));
  }

  addEnemy(combatant: Combatant): void {
    this._enemies.set(combatant.id, this._toState(combatant));
  }

  loadDatabase(db: BattleDatabase): void {
    this._db = db;
  }

  setDamageFormula(
    fn: (
      atk: number,
      def: number,
      power: number,
      isCrit: boolean,
      critMultiplier: number,
    ) => number,
  ): void {
    this._physicalFormula = fn;
  }

  // --- Events ---

  onEvent(handler: (event: BattleEvent) => void): () => void {
    this._handlers.add(handler);
    return () => {
      this._handlers.delete(handler);
    };
  }

  // --- Battle lifecycle ---

  start(): void {
    if (this._destroyed) return;
    this._round = 1;
    this._phase = "input";
    this._pendingActions.clear();
    this._computeTurnOrder();
    this._emit({ kind: "battle-start" });
    this._emit({ kind: "round-start", round: this._round });
    this._beginInputPhase();
  }

  submitAction(combatantId: string, action: BattleAction): void {
    if (this._destroyed || this._phase !== "input") return;

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

  // --- State accessors ---

  getPhase(): BattlePhase {
    return this._phase;
  }

  getCombatant(id: string): Combatant | undefined {
    const state = this._party.get(id) ?? this._enemies.get(id);
    if (state === undefined) return undefined;
    return this._toSnapshot(state);
  }

  getParty(): readonly Combatant[] {
    return Array.from(this._party.values()).map((s) => this._toSnapshot(s));
  }

  getEnemies(): readonly Combatant[] {
    return Array.from(this._enemies.values()).map((s) => this._toSnapshot(s));
  }

  getRound(): number {
    return this._round;
  }

  destroy(): void {
    this._destroyed = true;
    this._handlers.clear();
  }

  // --- Private helpers ---

  private _toState(c: Combatant): _CombatantState {
    return {
      id: c.id,
      name: c.name,
      hp: c.stats.hp,
      maxHp: c.stats.maxHp,
      mp: c.stats.mp,
      maxMp: c.stats.maxMp,
      attack: c.stats.attack,
      defense: c.stats.defense,
      speed: c.stats.speed,
      luck: c.stats.luck,
      statusEffects: c.statusEffects.map((se) => ({ ...se })),
      isParty: c.isParty,
      insertionOrder: this._insertionCounter++,
    };
  }

  private _toSnapshot(state: _CombatantState): Combatant {
    return Object.freeze({
      id: state.id,
      name: state.name,
      stats: Object.freeze<BattleStats>({
        hp: state.hp,
        maxHp: state.maxHp,
        mp: state.mp,
        maxMp: state.maxMp,
        attack: state.attack,
        defense: state.defense,
        speed: state.speed,
        luck: state.luck,
      }),
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
    const states: _CombatantState[] = [
      ...this._party.values(),
      ...this._enemies.values(),
    ].filter((s) => s.hp > 0);

    states.sort((a, b) => {
      if (b.speed !== a.speed) return b.speed - a.speed;
      if (b.luck !== a.luck) return b.luck - a.luck;
      return a.insertionOrder - b.insertionOrder;
    });

    this._turnOrder = states.map((s) => s.id);
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
    this._phase = "resolving";

    for (const id of this._turnOrder) {
      if (this._readPhase() !== "resolving") break;

      const state = this._party.get(id) ?? this._enemies.get(id);
      if (state === undefined || state.hp <= 0) continue;

      // Apply status effects before this combatant acts
      this._applyStatusEffects(state);
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

    if (this._readPhase() === "resolving") {
      // Begin the next round
      this._round++;
      this._phase = "input";
      this._computeTurnOrder();
      this._emit({ kind: "round-start", round: this._round });
      this._beginInputPhase();
    }
  }

  private _applyStatusEffects(state: _CombatantState): void {
    const toExpire: string[] = [];

    // Iterate over a copy so removal mid-loop is safe
    for (const se of [...state.statusEffects]) {
      const def = this._db.statusEffects.find((d) => d.id === se.id);

      // HP drain
      if (
        state.hp > 0 &&
        def !== undefined &&
        def.hpDrainPercentPerTurn !== undefined &&
        def.hpDrainPercentPerTurn > 0
      ) {
        const drain = Math.floor(state.maxHp * def.hpDrainPercentPerTurn);
        state.hp = Math.max(0, state.hp - drain);
        this._emit({
          kind: "damage",
          sourceId: se.id,
          targetId: state.id,
          amount: drain,
          isCrit: false,
        });
        if (state.hp <= 0) {
          this._emit({ kind: "combatant-defeated", combatantId: state.id });
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
      this._emit({ kind: "status-expired", combatantId: state.id, effectId });
    }
  }

  private _effectiveStats(state: _CombatantState): {
    attack: number;
    defense: number;
  } {
    let atkMult = 1;
    let defMult = 1;

    for (const se of state.statusEffects) {
      const def = this._db.statusEffects.find((d) => d.id === se.id);
      if (def === undefined) continue;
      if (def.attackMultiplier !== undefined) atkMult *= def.attackMultiplier;
      if (def.defenseMultiplier !== undefined) defMult *= def.defenseMultiplier;
    }

    return {
      attack: state.attack * atkMult,
      defense: state.defense * defMult,
    };
  }

  private _rollCrit(luck: number): boolean {
    return Math.random() < this._critChance + luck / 100;
  }

  private _applyDamage(
    sourceId: string,
    target: _CombatantState,
    amount: number,
    isCrit: boolean,
  ): void {
    target.hp = Math.max(0, target.hp - amount);
    this._emit({
      kind: "damage",
      sourceId,
      targetId: target.id,
      amount,
      isCrit,
    });
    if (target.hp <= 0) {
      this._emit({ kind: "combatant-defeated", combatantId: target.id });
    }
  }

  private _applyHeal(
    sourceId: string,
    target: _CombatantState,
    amount: number,
  ): void {
    target.hp = Math.min(target.maxHp, target.hp + amount);
    this._emit({ kind: "heal", sourceId, targetId: target.id, amount });
  }

  private _executeAction(actor: _CombatantState, action: BattleAction): void {
    if (action.type === "flee") {
      if (Math.random() < this._fleeChance) {
        this._emit({ kind: "fled" });
        this._phase = "victory";
      }
      return;
    }

    if (action.type === "attack") {
      const target =
        this._party.get(action.targetId) ?? this._enemies.get(action.targetId);
      if (target === undefined || target.hp <= 0) return;

      const actEff = this._effectiveStats(actor);
      const tgtEff = this._effectiveStats(target);
      const isCrit = this._rollCrit(actor.luck);
      const dmg = this._physicalFormula(
        actEff.attack,
        tgtEff.defense,
        1.0,
        isCrit,
        this._critMultiplier,
      );
      this._applyDamage(actor.id, target, dmg, isCrit);
      return;
    }

    // action.type === 'skill'
    this._executeSkill(actor, action.skillId, action.targetId);
  }

  private _resolveTargets(
    actor: _CombatantState,
    targetType: SkillTargetType,
    primaryTargetId: string,
  ): _CombatantState[] {
    switch (targetType) {
      case "single-enemy": {
        const map = actor.isParty ? this._enemies : this._party;
        const t = map.get(primaryTargetId);
        return t !== undefined && t.hp > 0 ? [t] : [];
      }
      case "all-enemies": {
        const map = actor.isParty ? this._enemies : this._party;
        return Array.from(map.values()).filter((s) => s.hp > 0);
      }
      case "single-ally": {
        const map = actor.isParty ? this._party : this._enemies;
        const t = map.get(primaryTargetId);
        return t !== undefined && t.hp > 0 ? [t] : [];
      }
      case "all-allies": {
        const map = actor.isParty ? this._party : this._enemies;
        return Array.from(map.values()).filter((s) => s.hp > 0);
      }
      case "self": {
        return actor.hp > 0 ? [actor] : [];
      }
    }
  }

  private _executeSkill(
    actor: _CombatantState,
    skillId: string,
    primaryTargetId: string,
  ): void {
    const skill = this._db.skills.find((s) => s.id === skillId);
    if (skill === undefined) return;

    // Insufficient MP — fail silently, no event
    if (actor.mp < skill.mpCost) return;

    actor.mp -= skill.mpCost;
    this._emit({
      kind: "mp-cost",
      combatantId: actor.id,
      amount: skill.mpCost,
    });

    const targets = this._resolveTargets(
      actor,
      skill.targetType,
      primaryTargetId,
    );
    const actEff = this._effectiveStats(actor);

    for (const target of targets) {
      if (target.hp <= 0) continue;

      let amount = 0;
      let isCrit = false;

      switch (skill.formula) {
        case "physical": {
          isCrit = this._rollCrit(actor.luck);
          const tgtEff = this._effectiveStats(target);
          amount = this._physicalFormula(
            actEff.attack,
            tgtEff.defense,
            skill.power,
            isCrit,
            this._critMultiplier,
          );
          break;
        }
        case "magical": {
          isCrit = this._rollCrit(actor.luck);
          const tgtEff = this._effectiveStats(target);
          amount = Math.max(
            1,
            Math.floor(
              (actEff.attack * 1.5 - tgtEff.defense * 0.5) *
                skill.power *
                (isCrit ? this._critMultiplier : 1),
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
        this._applyHeal(actor.id, target, amount);
      } else {
        this._applyDamage(actor.id, target, amount, isCrit);
      }

      // Apply status effect if the target is still standing
      const seSpec = skill.statusEffect;
      if (
        seSpec !== undefined &&
        target.hp > 0 &&
        Math.random() < seSpec.chance
      ) {
        const seDef = this._db.statusEffects.find(
          (d) => d.id === seSpec.effectId,
        );
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
          this._emit({
            kind: "status-applied",
            combatantId: target.id,
            effectId: seDef.id,
            name: seDef.name,
          });
        }
      }
    }
  }

  private _checkEndConditions(): boolean {
    const allEnemiesDead = Array.from(this._enemies.values()).every(
      (s) => s.hp <= 0,
    );
    if (allEnemiesDead) {
      this._emit({ kind: "victory" });
      this._phase = "victory";
      return true;
    }

    const allPartyDead = Array.from(this._party.values()).every(
      (s) => s.hp <= 0,
    );
    if (allPartyDead) {
      this._emit({ kind: "defeat" });
      this._phase = "defeat";
      return true;
    }

    return false;
  }
}

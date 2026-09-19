# 23 — BattleSystem

`BattleSystem` is a turn-based RPG combat engine. It manages combatants, turn order, skill resolution, status effects, and emits events your UI can consume. It has no renderer — wiring up the visuals is your responsibility.

```typescript
import { BattleSystem } from "@emptysock/engine";
import type {
  Combatant,
  BattleDatabase,
  BattleAction,
  BattleEvent,
} from "@emptysock/engine";
```

---

## Quick start

```typescript
const battle = new BattleSystem({ critChance: 0.1, critMultiplier: 2 });

// Load skill definitions
battle.loadDatabase({
  skills: [
    {
      id: "fireball",
      name: "Fireball",
      mpCost: 8,
      targetType: "single-enemy",
      formula: "magical",
      power: 1.4,
    },
    {
      id: "heal",
      name: "Heal",
      mpCost: 6,
      targetType: "single-ally",
      formula: "fixed",
      power: 50,
      isHeal: true,
    },
  ],
  statusEffects: [{ id: "burn", name: "Burn", hpDrainPercentPerTurn: 0.05 }],
});

// Register combatants
battle.addPartyMember({
  id: "hero",
  name: "Hero",
  isParty: true,
  stats: {
    hp: 100,
    maxHp: 100,
    mp: 40,
    maxMp: 40,
    attack: 18,
    defense: 10,
    speed: 12,
    luck: 8,
  },
  statusEffects: [],
});
battle.addEnemy({
  id: "slime",
  name: "Slime",
  isParty: false,
  stats: {
    hp: 60,
    maxHp: 60,
    mp: 0,
    maxMp: 0,
    attack: 10,
    defense: 4,
    speed: 6,
    luck: 2,
  },
  statusEffects: [],
});

// Listen for events
battle.onEvent((event) => {
  switch (event.kind) {
    case "action-needed":
      showActionMenu(event.combatantId);
      break;
    case "damage":
      showDamageNumber(event.targetId, event.amount, event.isCrit);
      break;
    case "victory":
      showVictoryScreen();
      break;
    case "defeat":
      showGameOverScreen();
      break;
  }
});

// Start the battle — emits 'battle-start', then 'action-needed' for the first combatant
battle.start();
```

---

## Constructor options

```typescript
new BattleSystem(options?: BattleSystemOptions)
```

| Option           | Type             | Default  | Description                                  |
| ---------------- | ---------------- | -------- | -------------------------------------------- |
| `db`             | `BattleDatabase` | empty    | Pre-load skill and status effect definitions |
| `critChance`     | `number`         | `0.0625` | Probability of a critical hit (0–1)          |
| `critMultiplier` | `number`         | `1.5`    | Damage multiplier on a critical hit          |
| `fleeChance`     | `number`         | `0.5`    | Probability of successfully fleeing          |

---

## Setup methods

### `addPartyMember(combatant)`

Registers a player-controlled combatant. All party members get an `'action-needed'` event each round, in speed-descending order.

### `addEnemy(combatant)`

Registers an enemy combatant. Enemies act automatically (basic attack targeting a random party member).

### `loadDatabase(db)`

Sets the skill and status effect definitions. Call before `start()`. Can be called again after start to swap databases between battles.

### `setDamageFormula(fn)`

Replaces the default physical damage formula. Called per-hit with `(atk, def, power, isCrit, critMultiplier) => number`.

```typescript
// Example: flat damage reduction instead of halved defense
battle.setDamageFormula((atk, def, power, isCrit, critMult) =>
  Math.max(1, Math.floor((atk - def) * power * (isCrit ? critMult : 1))),
);
```

---

## Battle flow

### `start()`

Begins the battle. Emits `'battle-start'`, then `'round-start'`, then `'action-needed'` for the first party member that needs input.

### `submitAction(combatantId, action)`

Submits an action for a party member that received an `'action-needed'` event. Once every party member has submitted, the round resolves automatically.

```typescript
// Basic attack
battle.submitAction("hero", { type: "attack", targetId: "slime" });

// Use a skill
battle.submitAction("hero", {
  type: "skill",
  skillId: "fireball",
  targetId: "slime",
});

// Flee attempt
battle.submitAction("hero", { type: "flee" });
```

---

## Query methods

| Method             | Returns                  | Description                                                                |
| ------------------ | ------------------------ | -------------------------------------------------------------------------- |
| `getPhase()`       | `BattlePhase`            | Current phase: `'idle'`, `'input'`, `'resolving'`, `'victory'`, `'defeat'` |
| `getCombatant(id)` | `Combatant \| undefined` | Snapshot of a combatant's current stats                                    |
| `getParty()`       | `readonly Combatant[]`   | All party members                                                          |
| `getEnemies()`     | `readonly Combatant[]`   | All enemies                                                                |
| `getRound()`       | `number`                 | Current round number (starts at 1)                                         |

---

## Events reference

Subscribe with `battle.onEvent(handler)`. Returns an unsubscribe function.

```typescript
const unsubscribe = battle.onEvent((event) => {
  /* ... */
});
// Later:
unsubscribe();
```

| `event.kind`           | Fields                               | When                            |
| ---------------------- | ------------------------------------ | ------------------------------- |
| `'battle-start'`       | —                                    | `start()` was called            |
| `'round-start'`        | `round: number`                      | A new round begins              |
| `'action-needed'`      | `combatantId: string`                | Party member needs player input |
| `'damage'`             | `sourceId, targetId, amount, isCrit` | A hit landed                    |
| `'heal'`               | `sourceId, targetId, amount`         | A heal landed                   |
| `'mp-cost'`            | `combatantId, amount`                | MP was consumed                 |
| `'status-applied'`     | `combatantId, effectId, name`        | A status effect was applied     |
| `'status-expired'`     | `combatantId, effectId`              | A status effect wore off        |
| `'combatant-defeated'` | `combatantId`                        | A combatant's HP reached 0      |
| `'victory'`            | —                                    | All enemies defeated            |
| `'defeat'`             | —                                    | All party members defeated      |
| `'fled'`               | —                                    | Flee attempt succeeded          |

---

## Damage formulas

| `formula` id       | Description                                                          |
| ------------------ | -------------------------------------------------------------------- |
| `'physical'`       | `max(1, floor((atk - def/2) * power * critMult))` — default physical |
| `'magical'`        | Same formula but bypasses defense (uses 0 for def)                   |
| `'fixed'`          | `floor(power)` — ignores stats entirely                              |
| `'percent-max-hp'` | `floor(target.maxHp * power)` — percentage of target's max HP        |

---

## Data types

### `Combatant`

```typescript
interface Combatant {
  id: string;
  name: string;
  stats: BattleStats;
  statusEffects: readonly StatusEffect[];
  isParty: boolean;
}

interface BattleStats {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  attack: number;
  defense: number;
  speed: number;
  luck: number;
}
```

### `SkillDef`

```typescript
interface SkillDef {
  id: string;
  name: string;
  mpCost: number;
  targetType:
    | "single-enemy"
    | "all-enemies"
    | "single-ally"
    | "all-allies"
    | "self";
  formula: "physical" | "magical" | "fixed" | "percent-max-hp";
  power: number;
  isHeal?: boolean;
  statusEffect?: { effectId: string; chance: number };
}
```

### `StatusEffectDef`

```typescript
interface StatusEffectDef {
  id: string;
  name: string;
  hpDrainPercentPerTurn?: number; // e.g. 0.05 = 5% max HP per turn
  attackMultiplier?: number; // e.g. 0.5 = halved attack
  defenseMultiplier?: number; // e.g. 1.3 = 30% more defense
}
```

---

## Cleanup

Call `battle.destroy()` when a battle scene unloads. This clears all combatants, pending actions, and event listeners.

```typescript
class BattleScene extends Scene {
  private _battle!: BattleSystem;

  override async onLoad(): Promise<void> {
    this._battle = new BattleSystem();
    // ... setup ...
    this._battle.start();
  }

  override onDestroy(): void {
    this._battle.destroy();
  }
}
```

---

## Full scene example

```typescript
import { Scene, BattleSystem } from "@emptysock/engine";
import type { BattleEvent } from "@emptysock/engine";

class BattleScene extends Scene {
  private _battle!: BattleSystem;

  override async onLoad(): Promise<void> {
    this._battle = new BattleSystem({ critChance: 0.1 });

    this._battle.loadDatabase({
      skills: [
        {
          id: "slash",
          name: "Slash",
          mpCost: 0,
          targetType: "single-enemy",
          formula: "physical",
          power: 1.2,
        },
      ],
      statusEffects: [],
    });

    this._battle.addPartyMember({
      id: "knight",
      name: "Knight",
      isParty: true,
      stats: {
        hp: 120,
        maxHp: 120,
        mp: 20,
        maxMp: 20,
        attack: 22,
        defense: 14,
        speed: 10,
        luck: 5,
      },
      statusEffects: [],
    });

    this._battle.addEnemy({
      id: "dragon",
      name: "Dragon",
      isParty: false,
      stats: {
        hp: 300,
        maxHp: 300,
        mp: 60,
        maxMp: 60,
        attack: 28,
        defense: 18,
        speed: 8,
        luck: 3,
      },
      statusEffects: [],
    });

    this._battle.onEvent((e: BattleEvent) => this._handleEvent(e));
    this._battle.start();
  }

  private _handleEvent(e: BattleEvent): void {
    if (e.kind === "action-needed") {
      // Show the action menu for e.combatantId
      this._battle.submitAction(e.combatantId, {
        type: "skill",
        skillId: "slash",
        targetId: "dragon",
      });
    }
    if (e.kind === "victory") {
      SceneManagerInstance.transition("overworld", { duration: 0.3 });
    }
  }

  override onDestroy(): void {
    this._battle.destroy();
  }
}
```

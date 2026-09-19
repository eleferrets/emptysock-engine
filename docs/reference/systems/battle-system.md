# BattleSystem

`BattleSystem` is a turn-based RPG combat engine. It manages combatants, turn order, skill resolution, status effects, and emits events for the UI to consume. It has no renderer.

Import: `import { BattleSystem } from '@emptysock/engine';`

For a complete guide with examples see [`docs/manual/23-battle-system.md`](../../manual/23-battle-system.md).

---

## Constructor

```typescript
new BattleSystem(options?: BattleSystemOptions)
```

| Option           | Type             | Default  | Description                           |
| ---------------- | ---------------- | -------- | ------------------------------------- |
| `db`             | `BattleDatabase` | empty    | Pre-load skill and status effect defs |
| `critChance`     | `number`         | `0.0625` | Probability of a critical hit (0–1)   |
| `critMultiplier` | `number`         | `1.5`    | Damage multiplier on a critical hit   |
| `fleeChance`     | `number`         | `0.5`    | Probability of successfully fleeing   |

---

## Configuration (call before `start()`)

### `loadDatabase(db: BattleDatabase): void`

Load skill and status effect definitions.

### `setDamageFormula(fn): void`

Replace the default physical damage formula: `(ctx: DamageContext) => number`.

---

## Battle flow

### `start(party: readonly Combatant[], enemies: readonly Combatant[]): void`

Begin a battle with the given roster, replacing any previous one. Party members receive `'action-needed'` events each round, in turn order; enemies act automatically (basic attack on the lowest-HP living party member). Emits `'battle-start'`, then `'round-start'`, then `'action-needed'` for the first combatant in turn order.

### `submitAction(combatantId: string, action: BattleAction): void`

Submit an action for a party member. Once every party member submits, the round resolves automatically.

```typescript
battle.submitAction("hero", { type: "attack", targetId: "slime" });
battle.submitAction("hero", {
  type: "skill",
  skillId: "fireball",
  targetId: "slime",
});
battle.submitAction("hero", { type: "flee" });
```

---

## Query methods

| Method             | Returns                  | Description                                                 |
| ------------------ | ------------------------ | ----------------------------------------------------------- |
| `getPhase()`       | `BattlePhase`            | `'idle' \| 'input' \| 'resolving' \| 'victory' \| 'defeat'` |
| `getCombatant(id)` | `Combatant \| undefined` | Snapshot of a combatant's current stats                     |
| `getParty()`       | `readonly Combatant[]`   | All party members                                           |
| `getEnemies()`     | `readonly Combatant[]`   | All enemies                                                 |
| `getRound()`       | `number`                 | Current round number (starts at 1)                          |

---

## Events

### `subscribe(handler: (event: BattleEvent) => void): () => void`

Subscribe to battle events. Returns an unsubscribe function.

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

| `formula`          | Description                                                          |
| ------------------ | -------------------------------------------------------------------- |
| `'physical'`       | `max(1, floor((atk - def/2) * power * critMult))` — default physical |
| `'magical'`        | Same formula but bypasses defense (uses 0 for def)                   |
| `'fixed'`          | `floor(power)` — ignores stats entirely                              |
| `'percent-max-hp'` | `floor(target.maxHp * power)` — percentage of target's max HP        |

---

## Cleanup

### `destroy(): void`

Clears all combatants, pending actions, and event listeners. Call in `onDestroy`.

```typescript
override onDestroy(): void {
  this._battle.destroy();
}
```

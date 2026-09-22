[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [battle/src](../README.md) / BattleSystem

# Class: BattleSystem

Defined in: [battle/src/BattleSystem.ts:197](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/battle/src/BattleSystem.ts#L197)

Turn-based RPG combat engine. Owns combatant state, turn order, damage
formulas, status-effect resolution, and the input/resolving/victory/defeat
phase machine. It emits `BattleEvent`s for the caller to render; it has no
renderer of its own.

Public surface is intentionally narrow:
- `start()` begins a battle from a party and enemy roster.
- `submitAction()` is the only way to advance an in-progress battle.
- `subscribe()` is the only way to observe what happened.
- The `get*` queries are read-only snapshots.

Turn order, formula application, and status-effect resolution are fully
internal — there is no public API for stepping through them piecemeal.

## Constructors

### Constructor

> **new BattleSystem**(`options?`): `BattleSystem`

Defined in: [battle/src/BattleSystem.ts:239](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/battle/src/BattleSystem.ts#L239)

#### Parameters

##### options?

[`BattleSystemOptions`](../interfaces/BattleSystemOptions.md)

#### Returns

`BattleSystem`

## Methods

### destroy()

> **destroy**(): `void`

Defined in: [battle/src/BattleSystem.ts:365](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/battle/src/BattleSystem.ts#L365)

#### Returns

`void`

***

### getCombatant()

> **getCombatant**(`id`): [`Combatant`](../interfaces/Combatant.md) \| `undefined`

Defined in: [battle/src/BattleSystem.ts:352](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/battle/src/BattleSystem.ts#L352)

#### Parameters

##### id

`string`

#### Returns

[`Combatant`](../interfaces/Combatant.md) \| `undefined`

***

### getEnemies()

> **getEnemies**(): [`Combatant`](../interfaces/Combatant.md)[]

Defined in: [battle/src/BattleSystem.ts:361](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/battle/src/BattleSystem.ts#L361)

#### Returns

[`Combatant`](../interfaces/Combatant.md)[]

***

### getParty()

> **getParty**(): [`Combatant`](../interfaces/Combatant.md)[]

Defined in: [battle/src/BattleSystem.ts:357](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/battle/src/BattleSystem.ts#L357)

#### Returns

[`Combatant`](../interfaces/Combatant.md)[]

***

### getPhase()

> **getPhase**(): [`BattlePhase`](../type-aliases/BattlePhase.md)

Defined in: [battle/src/BattleSystem.ts:345](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/battle/src/BattleSystem.ts#L345)

#### Returns

[`BattlePhase`](../type-aliases/BattlePhase.md)

***

### getRound()

> **getRound**(): `number`

Defined in: [battle/src/BattleSystem.ts:348](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/battle/src/BattleSystem.ts#L348)

#### Returns

`number`

***

### loadDatabase()

> **loadDatabase**(`db`): `void`

Defined in: [battle/src/BattleSystem.ts:259](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/battle/src/BattleSystem.ts#L259)

Load skill and status effect definitions. Call before `start()`.

#### Parameters

##### db

[`BattleDatabase`](../interfaces/BattleDatabase.md)

#### Returns

`void`

***

### setDamageFormula()

> **setDamageFormula**(`fn`): `void`

Defined in: [battle/src/BattleSystem.ts:276](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/battle/src/BattleSystem.ts#L276)

Replace the physical damage formula. Called with a `DamageContext` that
exposes status-adjusted attack/defense and full combatant snapshots (for
any custom stat access). Return the final integer damage amount.

#### Parameters

##### fn

(`ctx`) => `number`

#### Returns

`void`

#### Example

```ts
battle.setDamageFormula((ctx) => {
  const magicPower = ctx.attacker.stats['magic'] ?? 0;
  return Math.max(1, Math.floor(magicPower * ctx.power - ctx.effectiveDefense / 4));
});
```

***

### start()

> **start**(`party`, `enemies`): `void`

Defined in: [battle/src/BattleSystem.ts:297](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/battle/src/BattleSystem.ts#L297)

Begin a battle with the given party and enemy roster. Replaces any
previous roster. Emits `'battle-start'`, then `'round-start'`, then
`'action-needed'` for the first party member in turn order.

#### Parameters

##### party

readonly [`Combatant`](../interfaces/Combatant.md)[]

##### enemies

readonly [`Combatant`](../interfaces/Combatant.md)[]

#### Returns

`void`

***

### submitAction()

> **submitAction**(`combatantId`, `action`): `void`

Defined in: [battle/src/BattleSystem.ts:320](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/battle/src/BattleSystem.ts#L320)

Submit an action for a party member. Once every party member awaiting
input has submitted, the round resolves automatically: enemies act,
status effects tick, and either the next round begins or the battle
ends in victory/defeat.

#### Parameters

##### combatantId

`string`

##### action

[`BattleAction`](../type-aliases/BattleAction.md)

#### Returns

`void`

***

### subscribe()

> **subscribe**(`handler`): () => `void`

Defined in: [battle/src/BattleSystem.ts:283](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/battle/src/BattleSystem.ts#L283)

Subscribe to battle events. Returns an unsubscribe function.

#### Parameters

##### handler

(`event`) => `void`

#### Returns

() => `void`

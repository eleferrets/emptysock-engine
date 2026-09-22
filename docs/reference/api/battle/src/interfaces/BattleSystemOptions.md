[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [battle/src](../README.md) / BattleSystemOptions

# Interface: BattleSystemOptions

Defined in: [battle/src/BattleSystem.ts:138](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/battle/src/BattleSystem.ts#L138)

## Properties

### critChance?

> `optional` **critChance?**: `number`

Defined in: [battle/src/BattleSystem.ts:140](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/battle/src/BattleSystem.ts#L140)

***

### critMultiplier?

> `optional` **critMultiplier?**: `number`

Defined in: [battle/src/BattleSystem.ts:141](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/battle/src/BattleSystem.ts#L141)

***

### db?

> `optional` **db?**: [`BattleDatabase`](BattleDatabase.md)

Defined in: [battle/src/BattleSystem.ts:139](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/battle/src/BattleSystem.ts#L139)

***

### fleeChance?

> `optional` **fleeChance?**: `number`

Defined in: [battle/src/BattleSystem.ts:142](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/battle/src/BattleSystem.ts#L142)

***

### statMap?

> `optional` **statMap?**: [`BattleStatMap`](BattleStatMap.md)

Defined in: [battle/src/BattleSystem.ts:148](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/battle/src/BattleSystem.ts#L148)

Map logical stat roles to the key names used in your BattleStats objects.
Lets you use custom or abbreviated names without losing built-in turn
ordering, crit, and formula behaviour.

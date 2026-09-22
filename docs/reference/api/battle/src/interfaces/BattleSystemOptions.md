[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [battle/src](../README.md) / BattleSystemOptions

# Interface: BattleSystemOptions

Defined in: [battle/src/BattleSystem.ts:147](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/battle/src/BattleSystem.ts#L147)

## Properties

### critChance?

> `optional` **critChance?**: `number`

Defined in: [battle/src/BattleSystem.ts:149](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/battle/src/BattleSystem.ts#L149)

***

### critMultiplier?

> `optional` **critMultiplier?**: `number`

Defined in: [battle/src/BattleSystem.ts:150](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/battle/src/BattleSystem.ts#L150)

***

### db?

> `optional` **db?**: [`BattleDatabase`](BattleDatabase.md)

Defined in: [battle/src/BattleSystem.ts:148](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/battle/src/BattleSystem.ts#L148)

***

### fleeChance?

> `optional` **fleeChance?**: `number`

Defined in: [battle/src/BattleSystem.ts:151](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/battle/src/BattleSystem.ts#L151)

***

### statMap?

> `optional` **statMap?**: [`BattleStatMap`](BattleStatMap.md)

Defined in: [battle/src/BattleSystem.ts:157](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/battle/src/BattleSystem.ts#L157)

Map logical stat roles to the key names used in your BattleStats objects.
Lets you use custom or abbreviated names without losing built-in turn
ordering, crit, and formula behaviour.

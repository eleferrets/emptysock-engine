[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [battle/src](../README.md) / BattleStatMap

# Interface: BattleStatMap

Defined in: [battle/src/BattleSystem.ts:110](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/battle/src/BattleSystem.ts#L110)

Maps logical stat roles to the key names in your BattleStats objects.
All fields are optional and default to the canonical name ('attack', etc.).

## Example

```ts
// Use abbreviations:
statMap: { attack: 'atk', defense: 'def', speed: 'spd', luck: 'lck' }

// Use a fully custom stat name as attack power:
statMap: { attack: 'spellPower' }
```

## Properties

### attack?

> `optional` **attack?**: `string`

Defined in: [battle/src/BattleSystem.ts:112](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/battle/src/BattleSystem.ts#L112)

Stat key used as attack power. Default: 'attack'.

***

### defense?

> `optional` **defense?**: `string`

Defined in: [battle/src/BattleSystem.ts:114](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/battle/src/BattleSystem.ts#L114)

Stat key used as defense. Default: 'defense'.

***

### luck?

> `optional` **luck?**: `string`

Defined in: [battle/src/BattleSystem.ts:118](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/battle/src/BattleSystem.ts#L118)

Stat key added to crit chance. Default: 'luck'.

***

### speed?

> `optional` **speed?**: `string`

Defined in: [battle/src/BattleSystem.ts:116](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/battle/src/BattleSystem.ts#L116)

Stat key used for turn order. Default: 'speed'.

[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [battle/src](../README.md) / BattleStatMap

# Interface: BattleStatMap

Defined in: [battle/src/BattleSystem.ts:119](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/battle/src/BattleSystem.ts#L119)

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

Defined in: [battle/src/BattleSystem.ts:121](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/battle/src/BattleSystem.ts#L121)

Stat key used as attack power. Default: 'attack'.

***

### defense?

> `optional` **defense?**: `string`

Defined in: [battle/src/BattleSystem.ts:123](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/battle/src/BattleSystem.ts#L123)

Stat key used as defense. Default: 'defense'.

***

### luck?

> `optional` **luck?**: `string`

Defined in: [battle/src/BattleSystem.ts:127](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/battle/src/BattleSystem.ts#L127)

Stat key added to crit chance. Default: 'luck'.

***

### speed?

> `optional` **speed?**: `string`

Defined in: [battle/src/BattleSystem.ts:125](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/battle/src/BattleSystem.ts#L125)

Stat key used for turn order. Default: 'speed'.

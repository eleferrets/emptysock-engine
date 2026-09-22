[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [battle/src](../README.md) / BattleStats

# Type Alias: BattleStats

> **BattleStats** = `object` & `Record`\<`string`, `number`\>

Defined in: [battle/src/BattleSystem.ts:20](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/battle/src/BattleSystem.ts#L20)

Stat block for a combatant. `hp`, `maxHp`, `mp`, `maxMp` are required and
drive battle lifecycle. Any additional numeric field is valid — define your
own stat names (`atk`, `str`, `agility`, …) and tell BattleSystem which key
to treat as attack/defense/speed/luck via `BattleSystemOptions.statMap`.

## Type Declaration

### hp

> `readonly` **hp**: `number`

### maxHp

> `readonly` **maxHp**: `number`

### maxMp

> `readonly` **maxMp**: `number`

### mp

> `readonly` **mp**: `number`

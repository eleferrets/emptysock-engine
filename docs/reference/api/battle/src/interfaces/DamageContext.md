[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [battle/src](../README.md) / DamageContext

# Interface: DamageContext

Defined in: [battle/src/BattleSystem.ts:135](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/battle/src/BattleSystem.ts#L135)

Context passed to a custom damage formula set via `setDamageFormula()`.
`effectiveAttack` and `effectiveDefense` already incorporate status
multipliers. Access `attacker.stats` and `target.stats` for any custom stat.

## Properties

### attacker

> `readonly` **attacker**: [`Combatant`](Combatant.md)

Defined in: [battle/src/BattleSystem.ts:136](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/battle/src/BattleSystem.ts#L136)

***

### critMultiplier

> `readonly` **critMultiplier**: `number`

Defined in: [battle/src/BattleSystem.ts:144](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/battle/src/BattleSystem.ts#L144)

***

### effectiveAttack

> `readonly` **effectiveAttack**: `number`

Defined in: [battle/src/BattleSystem.ts:139](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/battle/src/BattleSystem.ts#L139)

Attacker's attack stat after status multipliers.

***

### effectiveDefense

> `readonly` **effectiveDefense**: `number`

Defined in: [battle/src/BattleSystem.ts:141](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/battle/src/BattleSystem.ts#L141)

Target's defense stat after status multipliers.

***

### isCrit

> `readonly` **isCrit**: `boolean`

Defined in: [battle/src/BattleSystem.ts:143](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/battle/src/BattleSystem.ts#L143)

***

### power

> `readonly` **power**: `number`

Defined in: [battle/src/BattleSystem.ts:142](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/battle/src/BattleSystem.ts#L142)

***

### target

> `readonly` **target**: [`Combatant`](Combatant.md)

Defined in: [battle/src/BattleSystem.ts:137](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/battle/src/BattleSystem.ts#L137)

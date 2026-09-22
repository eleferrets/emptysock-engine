[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [battle/src](../README.md) / DamageContext

# Interface: DamageContext

Defined in: [battle/src/BattleSystem.ts:126](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/battle/src/BattleSystem.ts#L126)

Context passed to a custom damage formula set via `setDamageFormula()`.
`effectiveAttack` and `effectiveDefense` already incorporate status
multipliers. Access `attacker.stats` and `target.stats` for any custom stat.

## Properties

### attacker

> `readonly` **attacker**: [`Combatant`](Combatant.md)

Defined in: [battle/src/BattleSystem.ts:127](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/battle/src/BattleSystem.ts#L127)

***

### critMultiplier

> `readonly` **critMultiplier**: `number`

Defined in: [battle/src/BattleSystem.ts:135](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/battle/src/BattleSystem.ts#L135)

***

### effectiveAttack

> `readonly` **effectiveAttack**: `number`

Defined in: [battle/src/BattleSystem.ts:130](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/battle/src/BattleSystem.ts#L130)

Attacker's attack stat after status multipliers.

***

### effectiveDefense

> `readonly` **effectiveDefense**: `number`

Defined in: [battle/src/BattleSystem.ts:132](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/battle/src/BattleSystem.ts#L132)

Target's defense stat after status multipliers.

***

### isCrit

> `readonly` **isCrit**: `boolean`

Defined in: [battle/src/BattleSystem.ts:134](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/battle/src/BattleSystem.ts#L134)

***

### power

> `readonly` **power**: `number`

Defined in: [battle/src/BattleSystem.ts:133](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/battle/src/BattleSystem.ts#L133)

***

### target

> `readonly` **target**: [`Combatant`](Combatant.md)

Defined in: [battle/src/BattleSystem.ts:128](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/battle/src/BattleSystem.ts#L128)

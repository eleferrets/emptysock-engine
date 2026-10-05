[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [battle/src](../README.md) / DamageContext

# Interface: DamageContext

Defined in: battle/src/BattleSystem.ts:128

Context passed to a custom damage formula set via `setDamageFormula()`.
`effectiveAttack` and `effectiveDefense` already incorporate status
multipliers. Access `attacker.stats` and `target.stats` for any custom stat.

## Properties

### attacker

> `readonly` **attacker**: [`Combatant`](Combatant.md)

Defined in: battle/src/BattleSystem.ts:129

***

### critMultiplier

> `readonly` **critMultiplier**: `number`

Defined in: battle/src/BattleSystem.ts:137

***

### effectiveAttack

> `readonly` **effectiveAttack**: `number`

Defined in: battle/src/BattleSystem.ts:132

Attacker's attack stat after status multipliers.

***

### effectiveDefense

> `readonly` **effectiveDefense**: `number`

Defined in: battle/src/BattleSystem.ts:134

Target's defense stat after status multipliers.

***

### isCrit

> `readonly` **isCrit**: `boolean`

Defined in: battle/src/BattleSystem.ts:136

***

### power

> `readonly` **power**: `number`

Defined in: battle/src/BattleSystem.ts:135

***

### target

> `readonly` **target**: [`Combatant`](Combatant.md)

Defined in: battle/src/BattleSystem.ts:130

[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [battle/src](../README.md) / BattleEvent

# Type Alias: BattleEvent

> **BattleEvent** = \{ `kind`: `"battle-start"`; \} \| \{ `kind`: `"round-start"`; `round`: `number`; \} \| \{ `combatantId`: `string`; `kind`: `"action-needed"`; \} \| \{ `amount`: `number`; `isCrit`: `boolean`; `kind`: `"damage"`; `sourceId`: `string`; `targetId`: `string`; \} \| \{ `amount`: `number`; `kind`: `"heal"`; `sourceId`: `string`; `targetId`: `string`; \} \| \{ `amount`: `number`; `combatantId`: `string`; `kind`: `"mp-cost"`; \} \| \{ `combatantId`: `string`; `effectId`: `string`; `kind`: `"status-applied"`; `name`: `string`; \} \| \{ `combatantId`: `string`; `effectId`: `string`; `kind`: `"status-expired"`; \} \| \{ `combatantId`: `string`; `kind`: `"combatant-defeated"`; \} \| \{ `kind`: `"victory"`; \} \| \{ `kind`: `"defeat"`; \} \| \{ `kind`: `"fled"`; \}

Defined in: [battle/src/BattleSystem.ts:74](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/battle/src/BattleSystem.ts#L74)

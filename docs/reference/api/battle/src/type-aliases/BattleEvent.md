[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [battle/src](../README.md) / BattleEvent

# Type Alias: BattleEvent

> **BattleEvent** = \{ `kind`: `"battle-start"`; \} \| \{ `kind`: `"round-start"`; `round`: `number`; \} \| \{ `combatantId`: `string`; `kind`: `"action-needed"`; \} \| \{ `amount`: `number`; `isCrit`: `boolean`; `kind`: `"damage"`; `sourceId`: `string`; `targetId`: `string`; \} \| \{ `amount`: `number`; `kind`: `"heal"`; `sourceId`: `string`; `targetId`: `string`; \} \| \{ `amount`: `number`; `combatantId`: `string`; `kind`: `"mp-cost"`; \} \| \{ `combatantId`: `string`; `effectId`: `string`; `kind`: `"status-applied"`; `name`: `string`; \} \| \{ `combatantId`: `string`; `effectId`: `string`; `kind`: `"status-expired"`; \} \| \{ `combatantId`: `string`; `kind`: `"combatant-defeated"`; \} \| \{ `kind`: `"victory"`; \} \| \{ `kind`: `"defeat"`; \} \| \{ `kind`: `"fled"`; \}

Defined in: [battle/src/BattleSystem.ts:83](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/battle/src/BattleSystem.ts#L83)

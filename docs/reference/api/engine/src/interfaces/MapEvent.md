[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / MapEvent

# Interface: MapEvent

Defined in: [engine/src/systems/MapEventSystem.ts:24](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/MapEventSystem.ts#L24)

## Properties

### commands

> **commands**: [`EventCommand`](../type-aliases/EventCommand.md)[]

Defined in: [engine/src/systems/MapEventSystem.ts:29](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/MapEventSystem.ts#L29)

***

### id

> **id**: `string`

Defined in: [engine/src/systems/MapEventSystem.ts:25](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/MapEventSystem.ts#L25)

***

### tileX

> **tileX**: `number`

Defined in: [engine/src/systems/MapEventSystem.ts:26](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/MapEventSystem.ts#L26)

***

### tileY

> **tileY**: `number`

Defined in: [engine/src/systems/MapEventSystem.ts:27](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/MapEventSystem.ts#L27)

***

### trigger

> **trigger**: [`EventTriggerType`](../type-aliases/EventTriggerType.md)

Defined in: [engine/src/systems/MapEventSystem.ts:28](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/MapEventSystem.ts#L28)

***

### when?

> `optional` **when?**: [`VariableCondition`](../type-aliases/VariableCondition.md)

Defined in: [engine/src/systems/MapEventSystem.ts:37](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/MapEventSystem.ts#L37)

Optional gate evaluated against the `VariableStore` before the event is
allowed to run. When present and false, `update()` skips the event
entirely — it never triggers, autoruns, or fires as a parallel process,
and it is re-checked every frame so it can start once the condition
becomes true.

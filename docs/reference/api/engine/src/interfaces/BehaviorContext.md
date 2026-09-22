[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / BehaviorContext

# Interface: BehaviorContext

Defined in: [engine/src/behaviors/Behavior.ts:4](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/behaviors/Behavior.ts#L4)

## Properties

### dt

> **dt**: `number`

Defined in: [engine/src/behaviors/Behavior.ts:6](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/behaviors/Behavior.ts#L6)

***

### entity

> **entity**: [`Entity`](../classes/Entity.md)

Defined in: [engine/src/behaviors/Behavior.ts:5](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/behaviors/Behavior.ts#L5)

***

### scene?

> `optional` **scene?**: [`Scene`](../classes/Scene.md)

Defined in: [engine/src/behaviors/Behavior.ts:8](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/behaviors/Behavior.ts#L8)

The scene that owns this entity. Null when called outside a scene (e.g. unit tests).

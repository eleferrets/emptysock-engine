[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / ViewportConfig

# Interface: ViewportConfig

Defined in: [engine/src/systems/ViewportSystem.ts:15](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/ViewportSystem.ts#L15)

## Properties

### container?

> `optional` **container?**: `HTMLElement`

Defined in: [engine/src/systems/ViewportSystem.ts:22](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/ViewportSystem.ts#L22)

Element that bounds the canvas. Falls back to window dimensions when absent.

***

### designHeight

> **designHeight**: `number`

Defined in: [engine/src/systems/ViewportSystem.ts:18](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/ViewportSystem.ts#L18)

***

### designWidth

> **designWidth**: `number`

Defined in: [engine/src/systems/ViewportSystem.ts:17](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/ViewportSystem.ts#L17)

Design (logical) resolution the game is authored against.

***

### scaleMode

> **scaleMode**: [`ScaleMode`](../type-aliases/ScaleMode.md)

Defined in: [engine/src/systems/ViewportSystem.ts:20](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/ViewportSystem.ts#L20)

How the design resolution maps onto the actual container size.

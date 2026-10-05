[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / ViewportConfig

# Interface: ViewportConfig

Defined in: engine/src/systems/ViewportSystem.ts:15

## Properties

### container?

> `optional` **container?**: `HTMLElement`

Defined in: engine/src/systems/ViewportSystem.ts:22

Element that bounds the canvas. Falls back to window dimensions when absent.

***

### designHeight

> **designHeight**: `number`

Defined in: engine/src/systems/ViewportSystem.ts:18

***

### designWidth

> **designWidth**: `number`

Defined in: engine/src/systems/ViewportSystem.ts:17

Design (logical) resolution the game is authored against.

***

### scaleMode

> **scaleMode**: [`ScaleMode`](../type-aliases/ScaleMode.md)

Defined in: engine/src/systems/ViewportSystem.ts:20

How the design resolution maps onto the actual container size.

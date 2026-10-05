[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / computeViewportSize

# Function: computeViewportSize()

> **computeViewportSize**(`designWidth`, `designHeight`, `availableWidth`, `availableHeight`, `scaleMode`): [`ViewportSize`](../interfaces/ViewportSize.md)

Defined in: engine/src/systems/ViewportSystem.ts:72

Computes the letterboxed/filled/stretched viewport size for a design
resolution against an available container size. Pure math — safe to unit
test without any DOM.

## Parameters

### designWidth

`number`

### designHeight

`number`

### availableWidth

`number`

### availableHeight

`number`

### scaleMode

[`ScaleMode`](../type-aliases/ScaleMode.md)

## Returns

[`ViewportSize`](../interfaces/ViewportSize.md)

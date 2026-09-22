[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / computeViewportSize

# Function: computeViewportSize()

> **computeViewportSize**(`designWidth`, `designHeight`, `availableWidth`, `availableHeight`, `scaleMode`): [`ViewportSize`](../interfaces/ViewportSize.md)

Defined in: [engine/src/systems/ViewportSystem.ts:72](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/ViewportSystem.ts#L72)

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

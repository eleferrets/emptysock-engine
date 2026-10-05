[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / resolveAnchoredPosition

# Function: resolveAnchoredPosition()

> **resolveAnchoredPosition**(`anchor`, `x`, `y`, `width`, `height`, `containerWidth`, `containerHeight`): [`AnchoredPosition`](../interfaces/AnchoredPosition.md)

Defined in: engine/src/ui/Anchor.ts:36

Resolves a designer-authored `(x, y)` offset from `anchor` against a
`containerWidth`x`containerHeight` box into an absolute top-left
`(left, top)` pair — e.g. `anchor: "bottom-right"` places the widget's
bottom-right corner `x` pixels left of and `y` pixels above the
container's own bottom-right corner.

## Parameters

### anchor

[`WidgetAnchor`](../type-aliases/WidgetAnchor.md)

### x

`number`

### y

`number`

### width

`number`

### height

`number`

### containerWidth

`number`

### containerHeight

`number`

## Returns

[`AnchoredPosition`](../interfaces/AnchoredPosition.md)

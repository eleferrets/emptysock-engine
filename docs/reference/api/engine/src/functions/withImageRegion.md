[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / withImageRegion

# Function: withImageRegion()

> **withImageRegion**\<`T`\>(`ctx`): `T`

Defined in: engine/src/ui/canvasHelpers.ts:70

Adds `drawImageRegion` to a Canvas2D context so `UISystem` can draw bitmap
fonts: a region blit is the nine-argument form of `drawImage`, which every
`CanvasRenderingContext2D` already has. The engine imports no DOM types, so
this only forwards the call; pass a real 2D context (or one with the same
nine-argument `drawImage`). Every other member is forwarded to `ctx`.

## Type Parameters

### T

`T` *extends* `IUIRenderer`

## Parameters

### ctx

`T`

## Returns

`T`

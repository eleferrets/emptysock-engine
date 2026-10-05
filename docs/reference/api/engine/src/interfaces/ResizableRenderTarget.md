[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / ResizableRenderTarget

# Interface: ResizableRenderTarget

Defined in: engine/src/systems/ViewportSystem.ts:10

The minimal shape ViewportSystem needs from a render target. Both
RenderSystem and RenderPipeline satisfy this structurally — pass either.

## Properties

### canvas

> `readonly` **canvas**: `HTMLCanvasElement`

Defined in: engine/src/systems/ViewportSystem.ts:12

## Methods

### resize()

> **resize**(`width`, `height`): `void`

Defined in: engine/src/systems/ViewportSystem.ts:11

#### Parameters

##### width

`number`

##### height

`number`

#### Returns

`void`

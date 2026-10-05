[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / CameraViewport

# Interface: CameraViewport

Defined in: engine/src/systems/RenderSystem.ts:50

The structural shape `renderMultiCamera()` needs from one active camera
slot. Re-declared here rather than importing `ActiveCameraViewport` from
the camera compat layer — `RenderSystem.ts` is core engine rendering and
must stay usable by any game, not just ones; `compat/` is a
translation layer that depends on the engine, never
the other way around (the same layering rule `RenderPipeline`'s
`TileLayerSource` interface already follows for `@emptysock/tilemap`).
the compat layer's exported `ActiveCameraViewport` is structurally
identical to this and satisfies it with no adapter needed.

## Properties

### id

> `readonly` **id**: `number`

Defined in: engine/src/systems/RenderSystem.ts:51

***

### rotation

> `readonly` **rotation**: `number`

Defined in: engine/src/systems/RenderSystem.ts:55

***

### screenHeight

> `readonly` **screenHeight**: `number`

Defined in: engine/src/systems/RenderSystem.ts:61

***

### screenWidth

> `readonly` **screenWidth**: `number`

Defined in: engine/src/systems/RenderSystem.ts:60

***

### screenX

> `readonly` **screenX**: `number`

Defined in: engine/src/systems/RenderSystem.ts:58

***

### screenY

> `readonly` **screenY**: `number`

Defined in: engine/src/systems/RenderSystem.ts:59

***

### viewHeight

> `readonly` **viewHeight**: `number`

Defined in: engine/src/systems/RenderSystem.ts:57

***

### viewWidth

> `readonly` **viewWidth**: `number`

Defined in: engine/src/systems/RenderSystem.ts:56

***

### x

> `readonly` **x**: `number`

Defined in: engine/src/systems/RenderSystem.ts:52

***

### y

> `readonly` **y**: `number`

Defined in: engine/src/systems/RenderSystem.ts:53

***

### zoom

> `readonly` **zoom**: `number`

Defined in: engine/src/systems/RenderSystem.ts:54

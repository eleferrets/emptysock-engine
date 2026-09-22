[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / RenderPipeline

# Class: RenderPipeline

Defined in: [engine/src/systems/RenderPipeline.ts:89](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/RenderPipeline.ts#L89)

RenderPipeline is the one piece of code a game needs to touch to see
something on screen. It owns a RenderSystem (the raw PixiJS renderer) and a
LayerSystem (draw order), and on every `renderFrame(scene)` call it:

 1. Walks the scene for every entity carrying both `Transform` and
    `Sprite`, keeps a PixiJS sprite in sync with it (position, rotation,
    scale, tint, alpha, anchor, visibility), loads its texture exactly
    once, and places it in the layer/depth the `Sprite` component asks
    for — no manual `layerSystem.addEntity()` call required.
 2. Draws any tilemap mounted via `mountTilemap()` as real textured tile
    sprites (optionally resolved through an `AutoTileSystem`), not just a
    walkability grid.
 3. Renders the frame.

Attaching `Transform` + `Sprite` to an entity is the entire contract for
"this shows up on screen" — there is no second, separate step.

## Constructors

### Constructor

> **new RenderPipeline**(`options?`): `RenderPipeline`

Defined in: [engine/src/systems/RenderPipeline.ts:106](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/RenderPipeline.ts#L106)

#### Parameters

##### options?

[`RenderPipelineOptions`](../interfaces/RenderPipelineOptions.md) = `{}`

#### Returns

`RenderPipeline`

## Accessors

### canvas

#### Get Signature

> **get** **canvas**(): `HTMLCanvasElement`

Defined in: [engine/src/systems/RenderPipeline.ts:128](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/RenderPipeline.ts#L128)

##### Returns

`HTMLCanvasElement`

***

### layers

#### Get Signature

> **get** **layers**(): [`LayerSystem`](LayerSystem.md)

Defined in: [engine/src/systems/RenderPipeline.ts:116](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/RenderPipeline.ts#L116)

The engine's LayerSystem — call `defineLayer()` on it for custom draw order.

##### Returns

[`LayerSystem`](LayerSystem.md)

***

### renderer

#### Get Signature

> **get** **renderer**(): `Renderer`

Defined in: [engine/src/systems/RenderPipeline.ts:120](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/RenderPipeline.ts#L120)

##### Returns

`Renderer`

***

### stage

#### Get Signature

> **get** **stage**(): `Container`

Defined in: [engine/src/systems/RenderPipeline.ts:124](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/RenderPipeline.ts#L124)

##### Returns

`Container`

## Methods

### destroy()

> **destroy**(): `void`

Defined in: [engine/src/systems/RenderPipeline.ts:410](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/RenderPipeline.ts#L410)

#### Returns

`void`

***

### init()

> **init**(`options?`): `Promise`\<`void`\>

Defined in: [engine/src/systems/RenderPipeline.ts:111](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/RenderPipeline.ts#L111)

#### Parameters

##### options?

[`RenderPipelineOptions`](../interfaces/RenderPipelineOptions.md) = `{}`

#### Returns

`Promise`\<`void`\>

***

### mountTilemap()

> **mountTilemap**(`tilemap`, `renderLayer?`, `autoTile?`): `void`

Defined in: [engine/src/systems/RenderPipeline.ts:321](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/RenderPipeline.ts#L321)

Build real tile sprites for `tilemap` and add them to `renderLayer`
(defaults to `"default"`). Pass an `AutoTileSystem` to resolve neighbour-
aware tile variants instead of drawing the raw tile indices. Safe to call
once per tilemap; call `unmountTilemap()` first to rebuild after edits.

#### Parameters

##### tilemap

[`TileLayerSource`](../interfaces/TileLayerSource.md)

##### renderLayer?

`string` = `"default"`

##### autoTile?

[`AutoTileSystem`](AutoTileSystem.md)

#### Returns

`void`

***

### renderFrame()

> **renderFrame**(`scene`, `postProcess?`): `void`

Defined in: [engine/src/systems/RenderPipeline.ts:143](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/RenderPipeline.ts#L143)

Sync every Transform+Sprite entity in `scene` to its PixiJS sprite, then
render the frame. Call this once per frame from the game loop, after
`SceneManager.update()`.

#### Parameters

##### scene

[`Scene`](Scene.md)

##### postProcess?

[`PostProcessSystem`](PostProcessSystem.md)

#### Returns

`void`

***

### renderTransitionOverlay()

> **renderTransitionOverlay**(`postProcess`): `void`

Defined in: [engine/src/systems/RenderPipeline.ts:166](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/RenderPipeline.ts#L166)

Paint the scene-transition overlay described by `postProcess`'s
transitionEffect/transitionProgress/transitionColour on top of the
stage. Called automatically from `renderFrame()` when a PostProcessSystem
is supplied; callers with a custom render loop can call it directly
after `syncEntities()`.

- "fade": full-screen colour rect, alpha rises to 1 over the first half
  of the transition and falls back to 0 over the second half (a
  crossfade through `transitionColour`).
- "wipe": a directional reveal — a colour rect that grows from one edge
  of the screen to the other as progress advances.
- "slide": a colour panel that pushes fully across the screen and off
  again, simulating the outgoing/incoming scene sliding — since
  RenderPipeline doesn't keep two scenes' worth of sprites live
  simultaneously, the panel itself carries the transition motion.

#### Parameters

##### postProcess

[`PostProcessSystem`](PostProcessSystem.md)

#### Returns

`void`

***

### resize()

> **resize**(`width`, `height`): `void`

Defined in: [engine/src/systems/RenderPipeline.ts:132](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/RenderPipeline.ts#L132)

#### Parameters

##### width

`number`

##### height

`number`

#### Returns

`void`

***

### syncEntities()

> **syncEntities**(`scene`): `void`

Defined in: [engine/src/systems/RenderPipeline.ts:221](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/RenderPipeline.ts#L221)

Sync PixiJS sprites from Transform+Sprite components without rendering. Exposed for tests and custom loops.

#### Parameters

##### scene

[`Scene`](Scene.md)

#### Returns

`void`

***

### unmountTilemap()

> **unmountTilemap**(`tilemap`): `void`

Defined in: [engine/src/systems/RenderPipeline.ts:334](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/RenderPipeline.ts#L334)

#### Parameters

##### tilemap

[`TileLayerSource`](../interfaces/TileLayerSource.md)

#### Returns

`void`

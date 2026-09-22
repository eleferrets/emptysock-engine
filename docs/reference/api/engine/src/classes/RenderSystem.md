[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / RenderSystem

# Class: RenderSystem

Defined in: [engine/src/systems/RenderSystem.ts:27](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/RenderSystem.ts#L27)

## Constructors

### Constructor

> **new RenderSystem**(): `RenderSystem`

#### Returns

`RenderSystem`

## Accessors

### canvas

#### Get Signature

> **get** **canvas**(): `HTMLCanvasElement`

Defined in: [engine/src/systems/RenderSystem.ts:192](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/RenderSystem.ts#L192)

##### Returns

`HTMLCanvasElement`

***

### renderer

#### Get Signature

> **get** **renderer**(): `Renderer`

Defined in: [engine/src/systems/RenderSystem.ts:181](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/RenderSystem.ts#L181)

##### Returns

`Renderer`

***

### stage

#### Get Signature

> **get** **stage**(): `Container`

Defined in: [engine/src/systems/RenderSystem.ts:187](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/RenderSystem.ts#L187)

##### Returns

`Container`

## Methods

### addLayerShaderFilter()

> **addLayerShaderFilter**(`layerName`, `filter`): `void`

Defined in: [engine/src/systems/RenderSystem.ts:170](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/RenderSystem.ts#L170)

Attach a custom shader filter (e.g. from `createCustomShaderFilter()`)
to a layer's container. This is the real counterpart to the ShaderEditor
IDE panel's live preview — the same Filter instance a shader authored
there produces is what gets attached here.

#### Parameters

##### layerName

`string`

##### filter

`Filter`

#### Returns

`void`

***

### destroy()

> **destroy**(): `void`

Defined in: [engine/src/systems/RenderSystem.ts:208](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/RenderSystem.ts#L208)

#### Returns

`void`

***

### getLayerContainer()

> **getLayerContainer**(`layerName?`): `Container`

Defined in: [engine/src/systems/RenderSystem.ts:110](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/RenderSystem.ts#L110)

Return the PixiJS Container for a given layer name. Creates it if it does
not yet exist (e.g. a layer was defined after init). Falls back to the
default container when no LayerSystem is active.

#### Parameters

##### layerName?

`string` = `"default"`

#### Returns

`Container`

***

### init()

> **init**(`options?`): `Promise`\<`void`\>

Defined in: [engine/src/systems/RenderSystem.ts:37](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/RenderSystem.ts#L37)

#### Parameters

##### options?

[`RenderSystemOptions`](../interfaces/RenderSystemOptions.md) = `{}`

#### Returns

`Promise`\<`void`\>

***

### removeLayerShaderFilter()

> **removeLayerShaderFilter**(`layerName`, `filter`): `void`

Defined in: [engine/src/systems/RenderSystem.ts:176](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/RenderSystem.ts#L176)

Detach a previously attached shader filter from a layer's container.

#### Parameters

##### layerName

`string`

##### filter

`Filter`

#### Returns

`void`

***

### render()

> **render**(): `void`

Defined in: [engine/src/systems/RenderSystem.ts:197](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/RenderSystem.ts#L197)

#### Returns

`void`

***

### resize()

> **resize**(`width`, `height`): `void`

Defined in: [engine/src/systems/RenderSystem.ts:204](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/RenderSystem.ts#L204)

#### Parameters

##### width

`number`

##### height

`number`

#### Returns

`void`

***

### setLayerSystem()

> **setLayerSystem**(`ls`): `void`

Defined in: [engine/src/systems/RenderSystem.ts:71](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/RenderSystem.ts#L71)

Attach a LayerSystem. May be called after init(). When set, entities
should be added to the container returned by getLayerContainer() rather
than directly to stage.

#### Parameters

##### ls

[`LayerSystem`](LayerSystem.md)

#### Returns

`void`

***

### syncLayerVisibility()

> **syncLayerVisibility**(): `void`

Defined in: [engine/src/systems/RenderSystem.ts:157](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/RenderSystem.ts#L157)

Synchronise layer container visibility from LayerSystem state. Call once
per frame (or on demand) after setVisible() calls.

#### Returns

`void`

[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / PostProcessSystem

# Class: PostProcessSystem

Defined in: engine/src/systems/PostProcessSystem.ts:235

## Constructors

### Constructor

> **new PostProcessSystem**(): `PostProcessSystem`

#### Returns

`PostProcessSystem`

## Properties

### transitionColour

> **transitionColour**: `number` = `0x000000`

Defined in: engine/src/systems/PostProcessSystem.ts:312

***

### transitionEffect

> **transitionEffect**: [`TransitionEffect`](../type-aliases/TransitionEffect.md) = `"none"`

Defined in: engine/src/systems/PostProcessSystem.ts:310

***

### transitionProgress

> **transitionProgress**: `number` = `0`

Defined in: engine/src/systems/PostProcessSystem.ts:311

## Accessors

### effects

#### Get Signature

> **get** **effects**(): readonly [`ActiveEffect`](../interfaces/ActiveEffect.md)[]

Defined in: engine/src/systems/PostProcessSystem.ts:331

##### Returns

readonly [`ActiveEffect`](../interfaces/ActiveEffect.md)[]

***

### flashActive

#### Get Signature

> **get** **flashActive**(): `boolean`

Defined in: engine/src/systems/PostProcessSystem.ts:355

##### Returns

`boolean`

***

### flashColour

#### Get Signature

> **get** **flashColour**(): `number`

Defined in: engine/src/systems/PostProcessSystem.ts:362

##### Returns

`number`

***

### flashIntensity

#### Get Signature

> **get** **flashIntensity**(): `number`

Defined in: engine/src/systems/PostProcessSystem.ts:358

##### Returns

`number`

***

### layerFilters

#### Get Signature

> **get** **layerFilters**(): `ReadonlyMap`\<`string`, [`LayerFilterOptions`](../interfaces/LayerFilterOptions.md)\>

Defined in: engine/src/systems/PostProcessSystem.ts:307

##### Returns

`ReadonlyMap`\<`string`, [`LayerFilterOptions`](../interfaces/LayerFilterOptions.md)\>

***

### transitionActive

#### Get Signature

> **get** **transitionActive**(): `boolean`

Defined in: engine/src/systems/PostProcessSystem.ts:375

Whether a transition overlay should currently be rendered.

##### Returns

`boolean`

## Methods

### add()

> **add**(`type`, `options?`): `this`

Defined in: engine/src/systems/PostProcessSystem.ts:314

#### Parameters

##### type

[`PostEffectType`](../type-aliases/PostEffectType.md)

##### options?

[`PostEffectOptions`](../type-aliases/PostEffectOptions.md) = `{}`

#### Returns

`this`

***

### beginTransition()

> **beginTransition**(`effect`, `colour?`): `void`

Defined in: engine/src/systems/PostProcessSystem.ts:368

#### Parameters

##### effect

[`TransitionEffect`](../type-aliases/TransitionEffect.md)

##### colour?

`number` = `0x000000`

#### Returns

`void`

***

### clear()

> **clear**(): `void`

Defined in: engine/src/systems/PostProcessSystem.ts:401

#### Returns

`void`

***

### clearLayerFilter()

> **clearLayerFilter**(`layerId`): `void`

Defined in: engine/src/systems/PostProcessSystem.ts:246

#### Parameters

##### layerId

`string`

#### Returns

`void`

***

### cssFilterForLayer()

> **cssFilterForLayer**(`layerId`): `string`

Defined in: engine/src/systems/PostProcessSystem.ts:260

Returns a CSS filter string for a layer, or '' if disabled/not set

#### Parameters

##### layerId

`string`

#### Returns

`string`

***

### destroy()

> **destroy**(): `void`

Defined in: engine/src/systems/PostProcessSystem.ts:408

#### Returns

`void`

***

### endTransition()

> **endTransition**(): `void`

Defined in: engine/src/systems/PostProcessSystem.ts:379

#### Returns

`void`

***

### flash()

> **flash**(`options?`): `void`

Defined in: engine/src/systems/PostProcessSystem.ts:337

#### Parameters

##### options?

[`FlashOptions`](../interfaces/FlashOptions.md) = `{}`

#### Returns

`void`

***

### get()

> **get**(`type`): [`ActiveEffect`](../interfaces/ActiveEffect.md) \| `undefined`

Defined in: engine/src/systems/PostProcessSystem.ts:327

#### Parameters

##### type

[`PostEffectType`](../type-aliases/PostEffectType.md)

#### Returns

[`ActiveEffect`](../interfaces/ActiveEffect.md) \| `undefined`

***

### getLayerFilter()

> **getLayerFilter**(`layerId`): [`LayerFilterOptions`](../interfaces/LayerFilterOptions.md) \| `undefined`

Defined in: engine/src/systems/PostProcessSystem.ts:255

#### Parameters

##### layerId

`string`

#### Returns

[`LayerFilterOptions`](../interfaces/LayerFilterOptions.md) \| `undefined`

***

### has()

> **has**(`type`): `boolean`

Defined in: engine/src/systems/PostProcessSystem.ts:323

#### Parameters

##### type

[`PostEffectType`](../type-aliases/PostEffectType.md)

#### Returns

`boolean`

***

### remove()

> **remove**(`type`): `void`

Defined in: engine/src/systems/PostProcessSystem.ts:319

#### Parameters

##### type

[`PostEffectType`](../type-aliases/PostEffectType.md)

#### Returns

`void`

***

### setLayerFilter()

> **setLayerFilter**(`layerId`, `filter`): `void`

Defined in: engine/src/systems/PostProcessSystem.ts:242

#### Parameters

##### layerId

`string`

##### filter

[`LayerFilterOptions`](../interfaces/LayerFilterOptions.md)

#### Returns

`void`

***

### toggleLayerFilter()

> **toggleLayerFilter**(`layerId`, `enabled`): `void`

Defined in: engine/src/systems/PostProcessSystem.ts:250

#### Parameters

##### layerId

`string`

##### enabled

`boolean`

#### Returns

`void`

***

### update()

> **update**(`deltaTime`): `void`

Defined in: engine/src/systems/PostProcessSystem.ts:386

#### Parameters

##### deltaTime

`number`

#### Returns

`void`

[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / PostProcessSystem

# Class: PostProcessSystem

Defined in: [engine/src/systems/PostProcessSystem.ts:209](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PostProcessSystem.ts#L209)

## Constructors

### Constructor

> **new PostProcessSystem**(): `PostProcessSystem`

#### Returns

`PostProcessSystem`

## Properties

### transitionColour

> **transitionColour**: `number` = `0x000000`

Defined in: [engine/src/systems/PostProcessSystem.ts:276](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PostProcessSystem.ts#L276)

***

### transitionEffect

> **transitionEffect**: `TransitionEffect` = `"none"`

Defined in: [engine/src/systems/PostProcessSystem.ts:274](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PostProcessSystem.ts#L274)

***

### transitionProgress

> **transitionProgress**: `number` = `0`

Defined in: [engine/src/systems/PostProcessSystem.ts:275](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PostProcessSystem.ts#L275)

## Accessors

### effects

#### Get Signature

> **get** **effects**(): readonly [`ActiveEffect`](../interfaces/ActiveEffect.md)[]

Defined in: [engine/src/systems/PostProcessSystem.ts:295](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PostProcessSystem.ts#L295)

##### Returns

readonly [`ActiveEffect`](../interfaces/ActiveEffect.md)[]

***

### flashActive

#### Get Signature

> **get** **flashActive**(): `boolean`

Defined in: [engine/src/systems/PostProcessSystem.ts:319](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PostProcessSystem.ts#L319)

##### Returns

`boolean`

***

### flashColour

#### Get Signature

> **get** **flashColour**(): `number`

Defined in: [engine/src/systems/PostProcessSystem.ts:326](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PostProcessSystem.ts#L326)

##### Returns

`number`

***

### flashIntensity

#### Get Signature

> **get** **flashIntensity**(): `number`

Defined in: [engine/src/systems/PostProcessSystem.ts:322](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PostProcessSystem.ts#L322)

##### Returns

`number`

***

### layerFilters

#### Get Signature

> **get** **layerFilters**(): `ReadonlyMap`\<`string`, [`LayerFilterOptions`](../interfaces/LayerFilterOptions.md)\>

Defined in: [engine/src/systems/PostProcessSystem.ts:271](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PostProcessSystem.ts#L271)

##### Returns

`ReadonlyMap`\<`string`, [`LayerFilterOptions`](../interfaces/LayerFilterOptions.md)\>

***

### transitionActive

#### Get Signature

> **get** **transitionActive**(): `boolean`

Defined in: [engine/src/systems/PostProcessSystem.ts:339](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PostProcessSystem.ts#L339)

Whether a transition overlay should currently be rendered.

##### Returns

`boolean`

## Methods

### add()

> **add**(`type`, `options?`): `this`

Defined in: [engine/src/systems/PostProcessSystem.ts:278](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PostProcessSystem.ts#L278)

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

Defined in: [engine/src/systems/PostProcessSystem.ts:332](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PostProcessSystem.ts#L332)

#### Parameters

##### effect

`TransitionEffect`

##### colour?

`number` = `0x000000`

#### Returns

`void`

***

### clear()

> **clear**(): `void`

Defined in: [engine/src/systems/PostProcessSystem.ts:365](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PostProcessSystem.ts#L365)

#### Returns

`void`

***

### clearLayerFilter()

> **clearLayerFilter**(`layerId`): `void`

Defined in: [engine/src/systems/PostProcessSystem.ts:220](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PostProcessSystem.ts#L220)

#### Parameters

##### layerId

`string`

#### Returns

`void`

***

### cssFilterForLayer()

> **cssFilterForLayer**(`layerId`): `string`

Defined in: [engine/src/systems/PostProcessSystem.ts:234](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PostProcessSystem.ts#L234)

Returns a CSS filter string for a layer, or '' if disabled/not set

#### Parameters

##### layerId

`string`

#### Returns

`string`

***

### destroy()

> **destroy**(): `void`

Defined in: [engine/src/systems/PostProcessSystem.ts:372](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PostProcessSystem.ts#L372)

#### Returns

`void`

***

### endTransition()

> **endTransition**(): `void`

Defined in: [engine/src/systems/PostProcessSystem.ts:343](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PostProcessSystem.ts#L343)

#### Returns

`void`

***

### flash()

> **flash**(`options?`): `void`

Defined in: [engine/src/systems/PostProcessSystem.ts:301](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PostProcessSystem.ts#L301)

#### Parameters

##### options?

[`FlashOptions`](../interfaces/FlashOptions.md) = `{}`

#### Returns

`void`

***

### get()

> **get**(`type`): [`ActiveEffect`](../interfaces/ActiveEffect.md) \| `undefined`

Defined in: [engine/src/systems/PostProcessSystem.ts:291](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PostProcessSystem.ts#L291)

#### Parameters

##### type

[`PostEffectType`](../type-aliases/PostEffectType.md)

#### Returns

[`ActiveEffect`](../interfaces/ActiveEffect.md) \| `undefined`

***

### getLayerFilter()

> **getLayerFilter**(`layerId`): [`LayerFilterOptions`](../interfaces/LayerFilterOptions.md) \| `undefined`

Defined in: [engine/src/systems/PostProcessSystem.ts:229](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PostProcessSystem.ts#L229)

#### Parameters

##### layerId

`string`

#### Returns

[`LayerFilterOptions`](../interfaces/LayerFilterOptions.md) \| `undefined`

***

### has()

> **has**(`type`): `boolean`

Defined in: [engine/src/systems/PostProcessSystem.ts:287](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PostProcessSystem.ts#L287)

#### Parameters

##### type

[`PostEffectType`](../type-aliases/PostEffectType.md)

#### Returns

`boolean`

***

### remove()

> **remove**(`type`): `void`

Defined in: [engine/src/systems/PostProcessSystem.ts:283](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PostProcessSystem.ts#L283)

#### Parameters

##### type

[`PostEffectType`](../type-aliases/PostEffectType.md)

#### Returns

`void`

***

### setLayerFilter()

> **setLayerFilter**(`layerId`, `filter`): `void`

Defined in: [engine/src/systems/PostProcessSystem.ts:216](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PostProcessSystem.ts#L216)

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

Defined in: [engine/src/systems/PostProcessSystem.ts:224](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PostProcessSystem.ts#L224)

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

Defined in: [engine/src/systems/PostProcessSystem.ts:350](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PostProcessSystem.ts#L350)

#### Parameters

##### deltaTime

`number`

#### Returns

`void`

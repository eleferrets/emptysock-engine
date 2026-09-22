[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / LightingSystem

# Class: LightingSystem

Defined in: [engine/src/systems/LightingSystem.ts:186](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/LightingSystem.ts#L186)

## Constructors

### Constructor

> **new LightingSystem**(): `LightingSystem`

#### Returns

`LightingSystem`

## Accessors

### ambientColour

#### Get Signature

> **get** **ambientColour**(): `number`

Defined in: [engine/src/systems/LightingSystem.ts:227](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/LightingSystem.ts#L227)

##### Returns

`number`

***

### ambientIntensity

#### Get Signature

> **get** **ambientIntensity**(): `number`

Defined in: [engine/src/systems/LightingSystem.ts:230](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/LightingSystem.ts#L230)

##### Returns

`number`

***

### lights

#### Get Signature

> **get** **lights**(): `ReadonlyMap`\<`string`, [`Light`](../interfaces/Light.md)\>

Defined in: [engine/src/systems/LightingSystem.ts:206](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/LightingSystem.ts#L206)

##### Returns

`ReadonlyMap`\<`string`, [`Light`](../interfaces/Light.md)\>

## Methods

### addLight()

> **addLight**(`config`): `void`

Defined in: [engine/src/systems/LightingSystem.ts:214](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/LightingSystem.ts#L214)

#### Parameters

##### config

[`Light`](../interfaces/Light.md)

#### Returns

`void`

***

### attachFilter()

> **attachFilter**(`stage`, `useNormalMap?`, `canvasWidth?`, `canvasHeight?`): `void`

Defined in: [engine/src/systems/LightingSystem.ts:242](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/LightingSystem.ts#L242)

Attach the GPU lighting filter to a PixiJS container (typically the scene stage).
This replaces the previous registry-only placeholder with real GPU rendering.

#### Parameters

##### stage

`Container`

##### useNormalMap?

`boolean` = `false`

##### canvasWidth?

`number` = `1280`

##### canvasHeight?

`number` = `720`

#### Returns

`void`

***

### detachFilter()

> **detachFilter**(): `void`

Defined in: [engine/src/systems/LightingSystem.ts:261](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/LightingSystem.ts#L261)

#### Returns

`void`

***

### removeLight()

> **removeLight**(`id`): `boolean`

Defined in: [engine/src/systems/LightingSystem.ts:218](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/LightingSystem.ts#L218)

#### Parameters

##### id

`string`

#### Returns

`boolean`

***

### setAmbient()

> **setAmbient**(`colour`, `intensity`): `void`

Defined in: [engine/src/systems/LightingSystem.ts:222](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/LightingSystem.ts#L222)

#### Parameters

##### colour

`number`

##### intensity

`number`

#### Returns

`void`

***

### setResolution()

> **setResolution**(`width`, `height`): `void`

Defined in: [engine/src/systems/LightingSystem.ts:256](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/LightingSystem.ts#L256)

#### Parameters

##### width

`number`

##### height

`number`

#### Returns

`void`

***

### update()

> **update**(`_dt`): `void`

Defined in: [engine/src/systems/LightingSystem.ts:275](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/LightingSystem.ts#L275)

#### Parameters

##### \_dt

`number`

#### Returns

`void`

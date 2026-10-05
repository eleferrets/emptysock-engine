[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / RainGlassFilter

# Class: RainGlassFilter

Defined in: engine/src/systems/RainGlassFilter.ts:158

## Extends

- `Filter`

## Constructors

### Constructor

> **new RainGlassFilter**(`options?`, `gpuTier?`): `RainGlassFilter`

Defined in: engine/src/systems/RainGlassFilter.ts:185

#### Parameters

##### options?

[`RainGlassFilterOptions`](../interfaces/RainGlassFilterOptions.md) = `{}`

##### gpuTier?

`"potato"` \| `"low"` \| `"mid"` \| `"high"` \| `"ultra"`

#### Returns

`RainGlassFilter`

#### Overrides

`Filter.constructor`

## Accessors

### dropCount

#### Get Signature

> **get** **dropCount**(): `number`

Defined in: engine/src/systems/RainGlassFilter.ts:397

##### Returns

`number`

***

### dropMap

#### Get Signature

> **get** **dropMap**(): `Uint8Array`

Defined in: engine/src/systems/RainGlassFilter.ts:413

##### Returns

`Uint8Array`

***

### elapsed

#### Get Signature

> **get** **elapsed**(): `number`

Defined in: engine/src/systems/RainGlassFilter.ts:401

##### Returns

`number`

***

### sim

#### Get Signature

> **get** **sim**(): [`RainGlassSim`](RainGlassSim.md)

Defined in: engine/src/systems/RainGlassFilter.ts:405

##### Returns

[`RainGlassSim`](RainGlassSim.md)

***

### tier

#### Get Signature

> **get** **tier**(): [`RainTier`](../interfaces/RainTier.md)

Defined in: engine/src/systems/RainGlassFilter.ts:409

##### Returns

[`RainTier`](../interfaces/RainTier.md)

***

### wiperAngle

#### Get Signature

> **get** **wiperAngle**(): `number`

Defined in: engine/src/systems/RainGlassFilter.ts:393

Blade angle in radians for a game-drawn wiper.

##### Returns

`number`

## Methods

### destroy()

> **destroy**(`destroyProgram?`): `void`

Defined in: engine/src/systems/RainGlassFilter.ts:417

Use to destroy the shader when its not longer needed.
It will destroy the resources and remove listeners.

#### Parameters

##### destroyProgram?

`boolean` = `false`

#### Returns

`void`

#### Overrides

`Filter.destroy`

***

### setOptions()

> **setOptions**(`options`): `void`

Defined in: engine/src/systems/RainGlassFilter.ts:331

#### Parameters

##### options

[`RainGlassFilterOptions`](../interfaces/RainGlassFilterOptions.md)

#### Returns

`void`

***

### setResolution()

> **setResolution**(`width`, `height`): `void`

Defined in: engine/src/systems/RainGlassFilter.ts:363

#### Parameters

##### width

`number`

##### height

`number`

#### Returns

`void`

***

### tick()

> **tick**(`dtSeconds`, `timeScale?`): `void`

Defined in: engine/src/systems/RainGlassFilter.ts:375

Advances the sim by `dtSeconds * timeScale`, uploads the map, and updates `uTime`.

#### Parameters

##### dtSeconds

`number`

##### timeScale?

`number` = `1`

#### Returns

`void`

***

### triggerWipe()

> **triggerWipe**(): `void`

Defined in: engine/src/systems/RainGlassFilter.ts:388

One-shot wiper sweep.

#### Returns

`void`

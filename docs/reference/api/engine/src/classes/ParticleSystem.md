[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / ParticleSystem

# Class: ParticleSystem

Defined in: engine/src/systems/ParticleSystem.ts:330

## Constructors

### Constructor

> **new ParticleSystem**(): `ParticleSystem`

#### Returns

`ParticleSystem`

## Accessors

### emitters

#### Get Signature

> **get** **emitters**(): `ReadonlySet`\<[`ParticleEmitter`](ParticleEmitter.md)\>

Defined in: engine/src/systems/ParticleSystem.ts:351

##### Returns

`ReadonlySet`\<[`ParticleEmitter`](ParticleEmitter.md)\>

## Methods

### clear()

> **clear**(): `void`

Defined in: engine/src/systems/ParticleSystem.ts:355

#### Returns

`void`

***

### create()

> **create**(`options?`): [`ParticleEmitter`](ParticleEmitter.md)

Defined in: engine/src/systems/ParticleSystem.ts:333

#### Parameters

##### options?

[`ParticleEmitterOptions`](../interfaces/ParticleEmitterOptions.md) = `{}`

#### Returns

[`ParticleEmitter`](ParticleEmitter.md)

***

### destroy()

> **destroy**(): `void`

Defined in: engine/src/systems/ParticleSystem.ts:359

#### Returns

`void`

***

### remove()

> **remove**(`emitter`): `void`

Defined in: engine/src/systems/ParticleSystem.ts:339

#### Parameters

##### emitter

[`ParticleEmitter`](ParticleEmitter.md)

#### Returns

`void`

***

### update()

> **update**(`deltaTime`): `void`

Defined in: engine/src/systems/ParticleSystem.ts:345

#### Parameters

##### deltaTime

`number`

#### Returns

`void`

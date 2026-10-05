[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / ParticleEmitter

# Class: ParticleEmitter

Defined in: engine/src/systems/ParticleSystem.ts:130

## Constructors

### Constructor

> **new ParticleEmitter**(`options?`): `ParticleEmitter`

Defined in: engine/src/systems/ParticleSystem.ts:141

#### Parameters

##### options?

[`ParticleEmitterOptions`](../interfaces/ParticleEmitterOptions.md) = `{}`

#### Returns

`ParticleEmitter`

## Properties

### active

> **active**: `boolean` = `true`

Defined in: engine/src/systems/ParticleSystem.ts:139

***

### options

> `readonly` **options**: `Required`\<[`ParticleEmitterOptions`](../interfaces/ParticleEmitterOptions.md)\>

Defined in: engine/src/systems/ParticleSystem.ts:133

***

### x

> **x**: `number` = `0`

Defined in: engine/src/systems/ParticleSystem.ts:131

***

### y

> **y**: `number` = `0`

Defined in: engine/src/systems/ParticleSystem.ts:132

## Accessors

### activeCount

#### Get Signature

> **get** **activeCount**(): `number`

Defined in: engine/src/systems/ParticleSystem.ts:312

##### Returns

`number`

## Methods

### clear()

> **clear**(): `void`

Defined in: engine/src/systems/ParticleSystem.ts:320

#### Returns

`void`

***

### emit()

> **emit**(`count`): `void`

Defined in: engine/src/systems/ParticleSystem.ts:170

Burst-emit N particles immediately.

#### Parameters

##### count

`number`

#### Returns

`void`

***

### getParticles()

> **getParticles**(): readonly `Particle`[]

Defined in: engine/src/systems/ParticleSystem.ts:308

Read-only snapshot of active particles for the render layer.

#### Returns

readonly `Particle`[]

***

### stop()

> **stop**(): `void`

Defined in: engine/src/systems/ParticleSystem.ts:316

#### Returns

`void`

***

### update()

> **update**(`deltaTime`): `void`

Defined in: engine/src/systems/ParticleSystem.ts:239

#### Parameters

##### deltaTime

`number`

#### Returns

`void`

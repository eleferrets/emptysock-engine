[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / ParticleEmitter

# Class: ParticleEmitter

Defined in: [engine/src/systems/ParticleSystem.ts:84](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/ParticleSystem.ts#L84)

## Constructors

### Constructor

> **new ParticleEmitter**(`options?`): `ParticleEmitter`

Defined in: [engine/src/systems/ParticleSystem.ts:95](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/ParticleSystem.ts#L95)

#### Parameters

##### options?

[`ParticleEmitterOptions`](../interfaces/ParticleEmitterOptions.md) = `{}`

#### Returns

`ParticleEmitter`

## Properties

### active

> **active**: `boolean` = `true`

Defined in: [engine/src/systems/ParticleSystem.ts:93](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/ParticleSystem.ts#L93)

***

### options

> `readonly` **options**: `Required`\<[`ParticleEmitterOptions`](../interfaces/ParticleEmitterOptions.md)\>

Defined in: [engine/src/systems/ParticleSystem.ts:87](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/ParticleSystem.ts#L87)

***

### x

> **x**: `number` = `0`

Defined in: [engine/src/systems/ParticleSystem.ts:85](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/ParticleSystem.ts#L85)

***

### y

> **y**: `number` = `0`

Defined in: [engine/src/systems/ParticleSystem.ts:86](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/ParticleSystem.ts#L86)

## Accessors

### activeCount

#### Get Signature

> **get** **activeCount**(): `number`

Defined in: [engine/src/systems/ParticleSystem.ts:225](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/ParticleSystem.ts#L225)

##### Returns

`number`

## Methods

### clear()

> **clear**(): `void`

Defined in: [engine/src/systems/ParticleSystem.ts:233](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/ParticleSystem.ts#L233)

#### Returns

`void`

***

### emit()

> **emit**(`count`): `void`

Defined in: [engine/src/systems/ParticleSystem.ts:120](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/ParticleSystem.ts#L120)

Burst-emit N particles immediately.

#### Parameters

##### count

`number`

#### Returns

`void`

***

### getParticles()

> **getParticles**(): readonly `Particle`[]

Defined in: [engine/src/systems/ParticleSystem.ts:221](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/ParticleSystem.ts#L221)

Read-only snapshot of active particles for the render layer.

#### Returns

readonly `Particle`[]

***

### stop()

> **stop**(): `void`

Defined in: [engine/src/systems/ParticleSystem.ts:229](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/ParticleSystem.ts#L229)

#### Returns

`void`

***

### update()

> **update**(`deltaTime`): `void`

Defined in: [engine/src/systems/ParticleSystem.ts:189](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/ParticleSystem.ts#L189)

#### Parameters

##### deltaTime

`number`

#### Returns

`void`

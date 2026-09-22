[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / ParticleSystem

# Class: ParticleSystem

Defined in: [engine/src/systems/ParticleSystem.ts:243](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/ParticleSystem.ts#L243)

## Constructors

### Constructor

> **new ParticleSystem**(): `ParticleSystem`

#### Returns

`ParticleSystem`

## Accessors

### emitters

#### Get Signature

> **get** **emitters**(): `ReadonlySet`\<[`ParticleEmitter`](ParticleEmitter.md)\>

Defined in: [engine/src/systems/ParticleSystem.ts:264](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/ParticleSystem.ts#L264)

##### Returns

`ReadonlySet`\<[`ParticleEmitter`](ParticleEmitter.md)\>

## Methods

### clear()

> **clear**(): `void`

Defined in: [engine/src/systems/ParticleSystem.ts:268](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/ParticleSystem.ts#L268)

#### Returns

`void`

***

### create()

> **create**(`options?`): [`ParticleEmitter`](ParticleEmitter.md)

Defined in: [engine/src/systems/ParticleSystem.ts:246](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/ParticleSystem.ts#L246)

#### Parameters

##### options?

[`ParticleEmitterOptions`](../interfaces/ParticleEmitterOptions.md) = `{}`

#### Returns

[`ParticleEmitter`](ParticleEmitter.md)

***

### destroy()

> **destroy**(): `void`

Defined in: [engine/src/systems/ParticleSystem.ts:272](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/ParticleSystem.ts#L272)

#### Returns

`void`

***

### remove()

> **remove**(`emitter`): `void`

Defined in: [engine/src/systems/ParticleSystem.ts:252](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/ParticleSystem.ts#L252)

#### Parameters

##### emitter

[`ParticleEmitter`](ParticleEmitter.md)

#### Returns

`void`

***

### update()

> **update**(`deltaTime`): `void`

Defined in: [engine/src/systems/ParticleSystem.ts:258](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/ParticleSystem.ts#L258)

#### Parameters

##### deltaTime

`number`

#### Returns

`void`

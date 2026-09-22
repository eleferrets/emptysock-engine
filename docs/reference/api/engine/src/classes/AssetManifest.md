[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / AssetManifest

# Class: AssetManifest

Defined in: [engine/src/systems/AssetManifest.ts:70](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/AssetManifest.ts#L70)

A declarative list of assets (textures/audio/json/fonts) with progress
reporting, so a game can build its own loading screen — the engine
intentionally never renders one itself. Loaded assets are cached here by
id and, for textures and audio, warm the same underlying caches that
RenderSystem and AudioSystem use, so gameplay code that touches them
afterwards does not trigger a redundant fetch.

## Constructors

### Constructor

> **new AssetManifest**(`options?`): `AssetManifest`

Defined in: [engine/src/systems/AssetManifest.ts:81](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/AssetManifest.ts#L81)

#### Parameters

##### options?

[`AssetManifestOptions`](../interfaces/AssetManifestOptions.md) = `{}`

#### Returns

`AssetManifest`

## Accessors

### failures

#### Get Signature

> **get** **failures**(): readonly [`AssetLoadFailure`](../interfaces/AssetLoadFailure.md)[]

Defined in: [engine/src/systems/AssetManifest.ts:110](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/AssetManifest.ts#L110)

##### Returns

readonly [`AssetLoadFailure`](../interfaces/AssetLoadFailure.md)[]

***

### total

#### Get Signature

> **get** **total**(): `number`

Defined in: [engine/src/systems/AssetManifest.ts:100](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/AssetManifest.ts#L100)

##### Returns

`number`

## Methods

### add()

> **add**(`descriptor`): `this`

Defined in: [engine/src/systems/AssetManifest.ts:90](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/AssetManifest.ts#L90)

#### Parameters

##### descriptor

[`AssetDescriptor`](../interfaces/AssetDescriptor.md)

#### Returns

`this`

***

### addAll()

> **addAll**(`descriptors`): `this`

Defined in: [engine/src/systems/AssetManifest.ts:95](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/AssetManifest.ts#L95)

#### Parameters

##### descriptors

[`AssetDescriptor`](../interfaces/AssetDescriptor.md)[]

#### Returns

`this`

***

### get()

> **get**(`id`): `unknown`

Defined in: [engine/src/systems/AssetManifest.ts:118](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/AssetManifest.ts#L118)

#### Parameters

##### id

`string`

#### Returns

`unknown`

***

### has()

> **has**(`id`): `boolean`

Defined in: [engine/src/systems/AssetManifest.ts:114](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/AssetManifest.ts#L114)

#### Parameters

##### id

`string`

#### Returns

`boolean`

***

### load()

> **load**(): `Promise`\<[`AssetLoadResult`](../interfaces/AssetLoadResult.md)\>

Defined in: [engine/src/systems/AssetManifest.ts:129](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/AssetManifest.ts#L129)

Loads every registered asset in order, reporting progress via
onProgress() as each one settles. Per-asset failures are collected in
`failures` (and the returned result) rather than rejecting the whole
batch, unless `continueOnError` is false, in which case load() rejects
with the AssetLoadFailure for the first asset that fails.

#### Returns

`Promise`\<[`AssetLoadResult`](../interfaces/AssetLoadResult.md)\>

***

### onProgress()

> **onProgress**(`listener`): () => `void`

Defined in: [engine/src/systems/AssetManifest.ts:105](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/AssetManifest.ts#L105)

Subscribe to progress updates. Returns an unsubscribe function.

#### Parameters

##### listener

[`AssetProgressListener`](../type-aliases/AssetProgressListener.md)

#### Returns

() => `void`

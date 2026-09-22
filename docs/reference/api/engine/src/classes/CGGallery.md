[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / CGGallery

# Class: CGGallery

Defined in: [engine/src/systems/CGGallery.ts:18](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/CGGallery.ts#L18)

## Constructors

### Constructor

> **new CGGallery**(`opts`): `CGGallery`

Defined in: [engine/src/systems/CGGallery.ts:24](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/CGGallery.ts#L24)

#### Parameters

##### opts

[`CGGalleryOptions`](../interfaces/CGGalleryOptions.md)

#### Returns

`CGGallery`

## Accessors

### entries

#### Get Signature

> **get** **entries**(): readonly [`CGEntry`](../interfaces/CGEntry.md)[]

Defined in: [engine/src/systems/CGGallery.ts:53](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/CGGallery.ts#L53)

##### Returns

readonly [`CGEntry`](../interfaces/CGEntry.md)[]

***

### totalCount

#### Get Signature

> **get** **totalCount**(): `number`

Defined in: [engine/src/systems/CGGallery.ts:61](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/CGGallery.ts#L61)

##### Returns

`number`

***

### unlockedCount

#### Get Signature

> **get** **unlockedCount**(): `number`

Defined in: [engine/src/systems/CGGallery.ts:65](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/CGGallery.ts#L65)

##### Returns

`number`

***

### unlockedEntries

#### Get Signature

> **get** **unlockedEntries**(): [`CGEntry`](../interfaces/CGEntry.md)[]

Defined in: [engine/src/systems/CGGallery.ts:57](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/CGGallery.ts#L57)

##### Returns

[`CGEntry`](../interfaces/CGEntry.md)[]

## Methods

### isUnlocked()

> **isUnlocked**(`id`): `boolean`

Defined in: [engine/src/systems/CGGallery.ts:49](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/CGGallery.ts#L49)

#### Parameters

##### id

`string`

#### Returns

`boolean`

***

### load()

> **load**(): `void`

Defined in: [engine/src/systems/CGGallery.ts:31](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/CGGallery.ts#L31)

Load unlocked flags from the save system

#### Returns

`void`

***

### unlock()

> **unlock**(`id`): `void`

Defined in: [engine/src/systems/CGGallery.ts:43](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/CGGallery.ts#L43)

Mark a CG as unlocked and persist

#### Parameters

##### id

`string`

#### Returns

`void`

[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / LocalisationSystem

# Class: LocalisationSystem

Defined in: [engine/src/systems/LocalisationSystem.ts:4](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/LocalisationSystem.ts#L4)

## Constructors

### Constructor

> **new LocalisationSystem**(): `LocalisationSystem`

#### Returns

`LocalisationSystem`

## Accessors

### currentLocale

#### Get Signature

> **get** **currentLocale**(): `string`

Defined in: [engine/src/systems/LocalisationSystem.ts:9](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/LocalisationSystem.ts#L9)

##### Returns

`string`

## Methods

### addTranslations()

> **addTranslations**(`locale`, `map`): `void`

Defined in: [engine/src/systems/LocalisationSystem.ts:20](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/LocalisationSystem.ts#L20)

#### Parameters

##### locale

`string`

##### map

[`TranslationMap`](../type-aliases/TranslationMap.md)

#### Returns

`void`

***

### destroy()

> **destroy**(): `void`

Defined in: [engine/src/systems/LocalisationSystem.ts:52](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/LocalisationSystem.ts#L52)

#### Returns

`void`

***

### onLocaleChange()

> **onLocaleChange**(`handler`): () => `void`

Defined in: [engine/src/systems/LocalisationSystem.ts:29](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/LocalisationSystem.ts#L29)

Subscribe to locale changes. Returns an unsubscriber function.
Useful for refreshing UI text after the player changes language.

#### Parameters

##### handler

(`locale`) => `void`

#### Returns

() => `void`

***

### setLocale()

> **setLocale**(`locale`): `void`

Defined in: [engine/src/systems/LocalisationSystem.ts:13](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/LocalisationSystem.ts#L13)

#### Parameters

##### locale

`string`

#### Returns

`void`

***

### t()

> **t**(`key`, `vars?`): `string`

Defined in: [engine/src/systems/LocalisationSystem.ts:37](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/LocalisationSystem.ts#L37)

#### Parameters

##### key

`string`

##### vars?

`Record`\<`string`, `string` \| `number`\>

#### Returns

`string`

***

### update()

> **update**(`_dt`): `void`

Defined in: [engine/src/systems/LocalisationSystem.ts:50](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/LocalisationSystem.ts#L50)

#### Parameters

##### \_dt

`number`

#### Returns

`void`

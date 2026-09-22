[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / CharacterStage

# Class: CharacterStage

Defined in: [engine/src/systems/CharacterStage.ts:34](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/CharacterStage.ts#L34)

## Constructors

### Constructor

> **new CharacterStage**(`opts`): `CharacterStage`

Defined in: [engine/src/systems/CharacterStage.ts:41](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/CharacterStage.ts#L41)

#### Parameters

##### opts

[`CharacterStageOptions`](../interfaces/CharacterStageOptions.md)

#### Returns

`CharacterStage`

## Methods

### clear()

> **clear**(): `void`

Defined in: [engine/src/systems/CharacterStage.ts:119](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/CharacterStage.ts#L119)

Remove all characters immediately

#### Returns

`void`

***

### hide()

> **hide**(`slot`, `fadeDuration?`): `void`

Defined in: [engine/src/systems/CharacterStage.ts:76](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/CharacterStage.ts#L76)

#### Parameters

##### slot

[`StageSlot`](../type-aliases/StageSlot.md)

##### fadeDuration?

`number` = `0.3`

#### Returns

`void`

***

### render()

> **render**(`ctx`): `void`

Defined in: [engine/src/systems/CharacterStage.ts:100](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/CharacterStage.ts#L100)

#### Parameters

##### ctx

`CanvasRenderingContext2D`

#### Returns

`void`

***

### show()

> **show**(`slot`, `imagePath`, `opts?`): `void`

Defined in: [engine/src/systems/CharacterStage.ts:48](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/CharacterStage.ts#L48)

#### Parameters

##### slot

[`StageSlot`](../type-aliases/StageSlot.md)

##### imagePath

`string`

##### opts?

[`CharacterShowOptions`](../interfaces/CharacterShowOptions.md) = `{}`

#### Returns

`void`

***

### update()

> **update**(`dt`): `void`

Defined in: [engine/src/systems/CharacterStage.ts:84](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/CharacterStage.ts#L84)

#### Parameters

##### dt

`number`

#### Returns

`void`

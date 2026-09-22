[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [vn/src](../README.md) / VNBackgroundLayer

# Class: VNBackgroundLayer

Defined in: [vn/src/VNBackgroundLayer.ts:73](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/vn/src/VNBackgroundLayer.ts#L73)

## Constructors

### Constructor

> **new VNBackgroundLayer**(`opts`): `VNBackgroundLayer`

Defined in: [vn/src/VNBackgroundLayer.ts:80](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/vn/src/VNBackgroundLayer.ts#L80)

#### Parameters

##### opts

[`VNBackgroundLayerOptions`](../interfaces/VNBackgroundLayerOptions.md)

#### Returns

`VNBackgroundLayer`

## Methods

### clearBackground()

> **clearBackground**(`fadeDuration?`): `void`

Defined in: [vn/src/VNBackgroundLayer.ts:102](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/vn/src/VNBackgroundLayer.ts#L102)

#### Parameters

##### fadeDuration?

`number`

#### Returns

`void`

***

### hideCG()

> **hideCG**(`fadeDuration?`): `void`

Defined in: [vn/src/VNBackgroundLayer.ts:125](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/vn/src/VNBackgroundLayer.ts#L125)

#### Parameters

##### fadeDuration?

`number`

#### Returns

`void`

***

### render()

> **render**(`ctx`): `void`

Defined in: [vn/src/VNBackgroundLayer.ts:156](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/vn/src/VNBackgroundLayer.ts#L156)

#### Parameters

##### ctx

`CanvasRenderingContext2D`

#### Returns

`void`

***

### setBackground()

> **setBackground**(`imagePath`, `opts?`): `void`

Defined in: [vn/src/VNBackgroundLayer.ts:86](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/vn/src/VNBackgroundLayer.ts#L86)

#### Parameters

##### imagePath

`string`

##### opts?

###### fadeDuration?

`number`

###### fit?

`FitMode`

#### Returns

`void`

***

### showCG()

> **showCG**(`imagePath`, `opts?`): `void`

Defined in: [vn/src/VNBackgroundLayer.ts:109](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/vn/src/VNBackgroundLayer.ts#L109)

#### Parameters

##### imagePath

`string`

##### opts?

###### fadeDuration?

`number`

###### fit?

`FitMode`

#### Returns

`void`

***

### update()

> **update**(`dt`): `void`

Defined in: [vn/src/VNBackgroundLayer.ts:132](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/vn/src/VNBackgroundLayer.ts#L132)

#### Parameters

##### dt

`number`

#### Returns

`void`

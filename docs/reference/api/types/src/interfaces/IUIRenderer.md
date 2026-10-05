[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [types/src](../README.md) / IUIRenderer

# Interface: IUIRenderer

Defined in: types/src/index.ts:180

Minimal drawing-context interface accepted by UISystem.render().

Uses only primitives — no DOM types. CanvasRenderingContext2D structurally
satisfies this interface, so existing callers that pass a canvas context
require no changes.

## Properties

### fillStyle

> **fillStyle**: `string` \| `object`

Defined in: types/src/index.ts:182

Colour or style used by fill operations. Accepts any string colour value.

***

### font

> **font**: `string`

Defined in: types/src/index.ts:186

***

### globalAlpha

> **globalAlpha**: `number`

Defined in: types/src/index.ts:189

***

### lineWidth

> **lineWidth**: `number`

Defined in: types/src/index.ts:185

***

### strokeStyle

> **strokeStyle**: `string` \| `object`

Defined in: types/src/index.ts:184

Colour or style used by stroke operations. Accepts any string colour value.

***

### textAlign

> **textAlign**: `string`

Defined in: types/src/index.ts:187

***

### textBaseline

> **textBaseline**: `string`

Defined in: types/src/index.ts:188

## Methods

### arc()

> **arc**(`x`, `y`, `r`, `startAngle`, `endAngle`): `void`

Defined in: types/src/index.ts:209

#### Parameters

##### x

`number`

##### y

`number`

##### r

`number`

##### startAngle

`number`

##### endAngle

`number`

#### Returns

`void`

***

### arcTo()

> **arcTo**(`x1`, `y1`, `x2`, `y2`, `r`): `void`

Defined in: types/src/index.ts:208

#### Parameters

##### x1

`number`

##### y1

`number`

##### x2

`number`

##### y2

`number`

##### r

`number`

#### Returns

`void`

***

### beginPath()

> **beginPath**(): `void`

Defined in: types/src/index.ts:193

#### Returns

`void`

***

### clip()

> **clip**(): `void`

Defined in: types/src/index.ts:244

Restrict subsequent drawing to the current path, until the next restore().

#### Returns

`void`

***

### closePath()

> **closePath**(): `void`

Defined in: types/src/index.ts:194

#### Returns

`void`

***

### drawImage()

> **drawImage**(`image`, `dx`, `dy`, `dw`, `dh`): `void`

Defined in: types/src/index.ts:218

Draw a pre-loaded image into the context at the given position and size.

#### Parameters

##### image

`object`

##### dx

`number`

##### dy

`number`

##### dw

`number`

##### dh

`number`

#### Returns

`void`

***

### drawImageRegion()?

> `optional` **drawImageRegion**(`image`, `sx`, `sy`, `sw`, `sh`, `dx`, `dy`, `dw`, `dh`): `void`

Defined in: types/src/index.ts:230

Optional 9-argument (source-region) form of `drawImage`, used by
`UISystem` to blit bitmap-font glyphs from an atlas. Canvas2D satisfies
it structurally. Renderers without it get the CSS-font text path.

#### Parameters

##### image

`object`

##### sx

`number`

##### sy

`number`

##### sw

`number`

##### sh

`number`

##### dx

`number`

##### dy

`number`

##### dw

`number`

##### dh

`number`

#### Returns

`void`

***

### fill()

> **fill**(): `void`

Defined in: types/src/index.ts:195

#### Returns

`void`

***

### fillRect()

> **fillRect**(`x`, `y`, `w`, `h`): `void`

Defined in: types/src/index.ts:241

#### Parameters

##### x

`number`

##### y

`number`

##### w

`number`

##### h

`number`

#### Returns

`void`

***

### fillText()

> **fillText**(`text`, `x`, `y`): `void`

Defined in: types/src/index.ts:216

#### Parameters

##### text

`string`

##### x

`number`

##### y

`number`

#### Returns

`void`

***

### lineTo()

> **lineTo**(`x`, `y`): `void`

Defined in: types/src/index.ts:207

#### Parameters

##### x

`number`

##### y

`number`

#### Returns

`void`

***

### moveTo()

> **moveTo**(`x`, `y`): `void`

Defined in: types/src/index.ts:206

#### Parameters

##### x

`number`

##### y

`number`

#### Returns

`void`

***

### rect()

> **rect**(`x`, `y`, `w`, `h`): `void`

Defined in: types/src/index.ts:197

#### Parameters

##### x

`number`

##### y

`number`

##### w

`number`

##### h

`number`

#### Returns

`void`

***

### restore()

> **restore**(): `void`

Defined in: types/src/index.ts:192

#### Returns

`void`

***

### roundRect()?

> `optional` **roundRect**(`x`, `y`, `w`, `h`, `r`): `void`

Defined in: types/src/index.ts:199

Optional — present in modern canvas implementations.

#### Parameters

##### x

`number`

##### y

`number`

##### w

`number`

##### h

`number`

##### r

`number` \| `number`[]

#### Returns

`void`

***

### save()

> **save**(): `void`

Defined in: types/src/index.ts:191

#### Returns

`void`

***

### stroke()

> **stroke**(): `void`

Defined in: types/src/index.ts:196

#### Returns

`void`

***

### strokeRect()

> **strokeRect**(`x`, `y`, `w`, `h`): `void`

Defined in: types/src/index.ts:242

#### Parameters

##### x

`number`

##### y

`number`

##### w

`number`

##### h

`number`

#### Returns

`void`

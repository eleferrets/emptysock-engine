[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / IUIRenderer

# Interface: IUIRenderer

Defined in: types/dist/index.d.ts:437

Minimal drawing-context interface accepted by UISystem.render().

Uses only primitives — no DOM types. CanvasRenderingContext2D structurally
satisfies this interface, so existing callers that pass a canvas context
require no changes.

## Properties

### fillStyle

> **fillStyle**: `string` \| `object`

Defined in: types/dist/index.d.ts:439

Colour or style used by fill operations. Accepts any string colour value.

***

### font

> **font**: `string`

Defined in: types/dist/index.d.ts:443

***

### globalAlpha

> **globalAlpha**: `number`

Defined in: types/dist/index.d.ts:446

***

### lineWidth

> **lineWidth**: `number`

Defined in: types/dist/index.d.ts:442

***

### strokeStyle

> **strokeStyle**: `string` \| `object`

Defined in: types/dist/index.d.ts:441

Colour or style used by stroke operations. Accepts any string colour value.

***

### textAlign

> **textAlign**: `string`

Defined in: types/dist/index.d.ts:444

***

### textBaseline

> **textBaseline**: `string`

Defined in: types/dist/index.d.ts:445

## Methods

### arc()

> **arc**(`x`, `y`, `r`, `startAngle`, `endAngle`): `void`

Defined in: types/dist/index.d.ts:459

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

Defined in: types/dist/index.d.ts:458

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

Defined in: types/dist/index.d.ts:449

#### Returns

`void`

***

### clip()

> **clip**(): `void`

Defined in: types/dist/index.d.ts:466

Restrict subsequent drawing to the current path, until the next restore().

#### Returns

`void`

***

### closePath()

> **closePath**(): `void`

Defined in: types/dist/index.d.ts:450

#### Returns

`void`

***

### drawImage()

> **drawImage**(`image`, `dx`, `dy`, `dw`, `dh`): `void`

Defined in: types/dist/index.d.ts:462

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

### fill()

> **fill**(): `void`

Defined in: types/dist/index.d.ts:451

#### Returns

`void`

***

### fillRect()

> **fillRect**(`x`, `y`, `w`, `h`): `void`

Defined in: types/dist/index.d.ts:463

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

Defined in: types/dist/index.d.ts:460

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

Defined in: types/dist/index.d.ts:457

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

Defined in: types/dist/index.d.ts:456

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

Defined in: types/dist/index.d.ts:453

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

Defined in: types/dist/index.d.ts:448

#### Returns

`void`

***

### roundRect()?

> `optional` **roundRect**(`x`, `y`, `w`, `h`, `r`): `void`

Defined in: types/dist/index.d.ts:455

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

Defined in: types/dist/index.d.ts:447

#### Returns

`void`

***

### stroke()

> **stroke**(): `void`

Defined in: types/dist/index.d.ts:452

#### Returns

`void`

***

### strokeRect()

> **strokeRect**(`x`, `y`, `w`, `h`): `void`

Defined in: types/dist/index.d.ts:464

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

[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [types/src](../README.md) / IUIRenderer

# Interface: IUIRenderer

Defined in: [types/src/index.ts:170](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/types/src/index.ts#L170)

Minimal drawing-context interface accepted by UISystem.render().

Uses only primitives — no DOM types. CanvasRenderingContext2D structurally
satisfies this interface, so existing callers that pass a canvas context
require no changes.

## Properties

### fillStyle

> **fillStyle**: `string` \| `object`

Defined in: [types/src/index.ts:172](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/types/src/index.ts#L172)

Colour or style used by fill operations. Accepts any string colour value.

***

### font

> **font**: `string`

Defined in: [types/src/index.ts:176](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/types/src/index.ts#L176)

***

### globalAlpha

> **globalAlpha**: `number`

Defined in: [types/src/index.ts:179](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/types/src/index.ts#L179)

***

### lineWidth

> **lineWidth**: `number`

Defined in: [types/src/index.ts:175](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/types/src/index.ts#L175)

***

### strokeStyle

> **strokeStyle**: `string` \| `object`

Defined in: [types/src/index.ts:174](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/types/src/index.ts#L174)

Colour or style used by stroke operations. Accepts any string colour value.

***

### textAlign

> **textAlign**: `string`

Defined in: [types/src/index.ts:177](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/types/src/index.ts#L177)

***

### textBaseline

> **textBaseline**: `string`

Defined in: [types/src/index.ts:178](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/types/src/index.ts#L178)

## Methods

### arc()

> **arc**(`x`, `y`, `r`, `startAngle`, `endAngle`): `void`

Defined in: [types/src/index.ts:199](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/types/src/index.ts#L199)

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

Defined in: [types/src/index.ts:198](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/types/src/index.ts#L198)

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

Defined in: [types/src/index.ts:183](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/types/src/index.ts#L183)

#### Returns

`void`

***

### clip()

> **clip**(): `void`

Defined in: [types/src/index.ts:218](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/types/src/index.ts#L218)

Restrict subsequent drawing to the current path, until the next restore().

#### Returns

`void`

***

### closePath()

> **closePath**(): `void`

Defined in: [types/src/index.ts:184](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/types/src/index.ts#L184)

#### Returns

`void`

***

### drawImage()

> **drawImage**(`image`, `dx`, `dy`, `dw`, `dh`): `void`

Defined in: [types/src/index.ts:208](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/types/src/index.ts#L208)

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

Defined in: [types/src/index.ts:185](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/types/src/index.ts#L185)

#### Returns

`void`

***

### fillRect()

> **fillRect**(`x`, `y`, `w`, `h`): `void`

Defined in: [types/src/index.ts:215](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/types/src/index.ts#L215)

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

Defined in: [types/src/index.ts:206](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/types/src/index.ts#L206)

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

Defined in: [types/src/index.ts:197](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/types/src/index.ts#L197)

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

Defined in: [types/src/index.ts:196](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/types/src/index.ts#L196)

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

Defined in: [types/src/index.ts:187](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/types/src/index.ts#L187)

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

Defined in: [types/src/index.ts:182](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/types/src/index.ts#L182)

#### Returns

`void`

***

### roundRect()?

> `optional` **roundRect**(`x`, `y`, `w`, `h`, `r`): `void`

Defined in: [types/src/index.ts:189](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/types/src/index.ts#L189)

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

Defined in: [types/src/index.ts:181](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/types/src/index.ts#L181)

#### Returns

`void`

***

### stroke()

> **stroke**(): `void`

Defined in: [types/src/index.ts:186](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/types/src/index.ts#L186)

#### Returns

`void`

***

### strokeRect()

> **strokeRect**(`x`, `y`, `w`, `h`): `void`

Defined in: [types/src/index.ts:216](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/types/src/index.ts#L216)

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

[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / UISystem

# Class: UISystem

Defined in: [engine/src/systems/UISystem.ts:22](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/UISystem.ts#L22)

## Constructors

### Constructor

> **new UISystem**(): `UISystem`

#### Returns

`UISystem`

## Accessors

### roots

#### Get Signature

> **get** **roots**(): readonly [`Widget`](Widget.md)[]

Defined in: [engine/src/systems/UISystem.ts:98](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/UISystem.ts#L98)

##### Returns

readonly [`Widget`](Widget.md)[]

***

### scale

#### Get Signature

> **get** **scale**(): `number`

Defined in: [engine/src/systems/UISystem.ts:54](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/UISystem.ts#L54)

##### Returns

`number`

## Methods

### add()

> **add**(`widget`): `void`

Defined in: [engine/src/systems/UISystem.ts:88](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/UISystem.ts#L88)

#### Parameters

##### widget

[`Widget`](Widget.md)

#### Returns

`void`

***

### cancelPointer()

> **cancelPointer**(`pointerId?`): `void`

Defined in: [engine/src/systems/UISystem.ts:268](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/UISystem.ts#L268)

Abort an in-flight press without firing `click` (e.g. pointercancel).

#### Parameters

##### pointerId?

`number` = `0`

#### Returns

`void`

***

### clear()

> **clear**(): `void`

Defined in: [engine/src/systems/UISystem.ts:102](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/UISystem.ts#L102)

#### Returns

`void`

***

### destroy()

> **destroy**(): `void`

Defined in: [engine/src/systems/UISystem.ts:273](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/UISystem.ts#L273)

Release all ImageBitmap allocations and clear the widget tree.

#### Returns

`void`

***

### dispatchPointerDown()

> **dispatchPointerDown**(`x`, `y`, `canvasWidth`, `canvasHeight`, `pointerId?`): `boolean`

Defined in: [engine/src/systems/UISystem.ts:179](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/UISystem.ts#L179)

Begin a press on the topmost widget under (x, y). Does not fire `click`
immediately — the click fires on `dispatchPointerUp` only if the pointer
did not move past the drag threshold, giving real press/drag/release
semantics for both mouse and touch instead of firing a click on down.
`pointerId` distinguishes simultaneous multi-touch presses (default 0
for a single mouse pointer).

#### Parameters

##### x

`number`

##### y

`number`

##### canvasWidth

`number`

##### canvasHeight

`number`

##### pointerId?

`number` = `0`

#### Returns

`boolean`

***

### dispatchPointerDrag()

> **dispatchPointerDrag**(`x`, `y`, `pointerId?`): `void`

Defined in: [engine/src/systems/UISystem.ts:203](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/UISystem.ts#L203)

Update an in-flight press's position. Once the pointer has moved past
`CLICK_DRAG_THRESHOLD` from its start point, the press is marked as a
drag and will not fire `click` on release.

#### Parameters

##### x

`number`

##### y

`number`

##### pointerId?

`number` = `0`

#### Returns

`void`

***

### dispatchPointerUp()

> **dispatchPointerUp**(`x`, `y`, `canvasWidth`, `canvasHeight`, `pointerId?`): `boolean`

Defined in: [engine/src/systems/UISystem.ts:251](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/UISystem.ts#L251)

Complete a press started with `dispatchPointerDown`. Fires `click` on the
pressed widget only if it was not marked as a drag (see
`dispatchPointerDrag`) and the release still lands on that same widget's
bounds — this is the real release semantics that `handleClick` alone
cannot express, since it always fires unconditionally on down.

#### Parameters

##### x

`number`

##### y

`number`

##### canvasWidth

`number`

##### canvasHeight

`number`

##### pointerId?

`number` = `0`

#### Returns

`boolean`

***

### getImage()

> **getImage**(`src`): `ImageBitmap` \| `undefined`

Defined in: [engine/src/systems/UISystem.ts:67](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/UISystem.ts#L67)

Fetch a loaded image from the cache, kicking off a load if not present.

#### Parameters

##### src

`string`

#### Returns

`ImageBitmap` \| `undefined`

***

### handleClick()

> **handleClick**(`x`, `y`, `canvasWidth`, `canvasHeight`): `boolean`

Defined in: [engine/src/systems/UISystem.ts:141](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/UISystem.ts#L141)

Legacy convenience: hit-test and immediately trigger a click on the
topmost matching widget, with no press/drag distinction. Prefer
`dispatchPointerDown` + `dispatchPointerUp` for real touch/mouse
semantics; this remains for callers that only need a single-shot click.

#### Parameters

##### x

`number`

##### y

`number`

##### canvasWidth

`number`

##### canvasHeight

`number`

#### Returns

`boolean`

***

### handlePointerMove()

> **handlePointerMove**(`x`, `y`, `canvasWidth`, `canvasHeight`): `void`

Defined in: [engine/src/systems/UISystem.ts:211](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/UISystem.ts#L211)

Update hover state given the current pointer position.

#### Parameters

##### x

`number`

##### y

`number`

##### canvasWidth

`number`

##### canvasHeight

`number`

#### Returns

`void`

***

### remove()

> **remove**(`widget`): `void`

Defined in: [engine/src/systems/UISystem.ts:93](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/UISystem.ts#L93)

#### Parameters

##### widget

[`Widget`](Widget.md)

#### Returns

`void`

***

### render()

> **render**(`ctx`, `canvasWidth`, `canvasHeight`): `void`

Defined in: [engine/src/systems/UISystem.ts:221](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/UISystem.ts#L221)

Draw all root widgets to the given renderer.

#### Parameters

##### ctx

[`IUIRenderer`](../interfaces/IUIRenderer.md)

##### canvasWidth

`number`

##### canvasHeight

`number`

#### Returns

`void`

***

### setImageLoader()

> **setImageLoader**(`loader`): `void`

Defined in: [engine/src/systems/UISystem.ts:62](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/UISystem.ts#L62)

Inject an ImageLoader so that ImageWidget components resolve their source
instead of rendering a grey placeholder. Call this once at game init.

#### Parameters

##### loader

`ImageLoader` \| `null`

#### Returns

`void`

***

### setScale()

> **setScale**(`scale`): `void`

Defined in: [engine/src/systems/UISystem.ts:44](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/UISystem.ts#L44)

Set the canvas-to-design-resolution scale factor used by widget
positioning, sizing, and hit-testing. Intended to be fed by a
ViewportSystem (canvas size / design resolution); applied to every root
widget's tree immediately.

#### Parameters

##### scale

`number`

#### Returns

`void`

***

### update()

> **update**(`dt`, `pointerX?`, `pointerY?`, `canvasWidth?`, `canvasHeight?`): `void`

Defined in: [engine/src/systems/UISystem.ts:110](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/UISystem.ts#L110)

Advance all active animations and update hover state.
Call once per frame before render(), passing delta-time in seconds.

#### Parameters

##### dt

`number`

##### pointerX?

`number`

##### pointerY?

`number`

##### canvasWidth?

`number`

##### canvasHeight?

`number`

#### Returns

`void`

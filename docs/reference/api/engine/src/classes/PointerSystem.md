[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / PointerSystem

# Class: PointerSystem

Defined in: engine/src/systems/PointerSystem.ts:153

## Constructors

### Constructor

> **new PointerSystem**(): `PointerSystem`

#### Returns

`PointerSystem`

## Accessors

### pointerCount

#### Get Signature

> **get** **pointerCount**(): `number`

Defined in: engine/src/systems/PointerSystem.ts:294

##### Returns

`number`

***

### pointers

#### Get Signature

> **get** **pointers**(): readonly [`PointerState`](../interfaces/PointerState.md)[]

Defined in: engine/src/systems/PointerSystem.ts:298

##### Returns

readonly [`PointerState`](../interfaces/PointerState.md)[]

***

### primaryPointer

#### Get Signature

> **get** **primaryPointer**(): [`PointerState`](../interfaces/PointerState.md) \| `undefined`

Defined in: engine/src/systems/PointerSystem.ts:308

Primary pointer (mouse, or first touch), if any is active.

##### Returns

[`PointerState`](../interfaces/PointerState.md) \| `undefined`

## Methods

### attach()

> **attach**(`target?`): `void`

Defined in: engine/src/systems/PointerSystem.ts:174

Attach native listeners. Guarded so it is a no-op outside a browser-like
environment (Node/Vitest) per the engine environment boundary — callers
may still feed synthetic events directly via the public dispatch methods
below for testing.

#### Parameters

##### target?

`EventTarget`

#### Returns

`void`

***

### destroy()

> **destroy**(): `void`

Defined in: engine/src/systems/PointerSystem.ts:240

Alias for detach() — compatible with SystemManager teardown.

#### Returns

`void`

***

### detach()

> **detach**(): `void`

Defined in: engine/src/systems/PointerSystem.ts:213

#### Returns

`void`

***

### dispatchPointerCancel()

> **dispatchPointerCancel**(`evt`): `void`

Defined in: engine/src/systems/PointerSystem.ts:423

#### Parameters

##### evt

###### pointerId

`number`

#### Returns

`void`

***

### dispatchPointerDown()

> **dispatchPointerDown**(`evt`): `void`

Defined in: engine/src/systems/PointerSystem.ts:333

#### Parameters

##### evt

###### buttons?

`number`

###### clientX

`number`

###### clientY

`number`

###### isPrimary?

`boolean`

###### pointerId

`number`

###### pointerType?

`string`

#### Returns

`void`

***

### dispatchPointerMove()

> **dispatchPointerMove**(`evt`): `void`

Defined in: engine/src/systems/PointerSystem.ts:363

#### Parameters

##### evt

###### clientX

`number`

###### clientY

`number`

###### pointerId

`number`

#### Returns

`void`

***

### dispatchPointerUp()

> **dispatchPointerUp**(`evt`): `void`

Defined in: engine/src/systems/PointerSystem.ts:380

#### Parameters

##### evt

###### clientX

`number`

###### clientY

`number`

###### pointerId

`number`

#### Returns

`void`

***

### dispatchSafariGestureChange()

> **dispatchSafariGestureChange**(`evt`): `void`

Defined in: engine/src/systems/PointerSystem.ts:475

Public, DOM-free entry point for Safari's `gesturechange` — see `dispatchSafariGestureStart`.

#### Parameters

##### evt

###### clientX

`number`

###### clientY

`number`

###### scale

`number`

#### Returns

`void`

***

### dispatchSafariGestureEnd()

> **dispatchSafariGestureEnd**(): `void`

Defined in: engine/src/systems/PointerSystem.ts:495

Public, DOM-free entry point for Safari's `gestureend` — see `dispatchSafariGestureStart`.

#### Returns

`void`

***

### dispatchSafariGestureStart()

> **dispatchSafariGestureStart**(): `void`

Defined in: engine/src/systems/PointerSystem.ts:470

Public, DOM-free entry point for Safari's `gesturestart` (see
`SafariGestureEvent`'s doc comment) — test-injectable the same way
`dispatchPointerDown`/`dispatchWheel` are, since jsdom (this repo's test
environment) doesn't implement WebKit's proprietary `GestureEvent`.

#### Returns

`void`

***

### dispatchWheel()

> **dispatchWheel**(`evt`): `void`

Defined in: engine/src/systems/PointerSystem.ts:435

#### Parameters

##### evt

###### ctrlKey?

`boolean`

###### deltaMode

`number`

###### deltaX

`number`

###### deltaY

`number`

#### Returns

`void`

***

### getPointer()

> **getPointer**(`id`): [`PointerState`](../interfaces/PointerState.md) \| `undefined`

Defined in: engine/src/systems/PointerSystem.ts:302

#### Parameters

##### id

`number`

#### Returns

[`PointerState`](../interfaces/PointerState.md) \| `undefined`

***

### onGesture()

> **onGesture**(`handler`): () => `void`

Defined in: engine/src/systems/PointerSystem.ts:278

#### Parameters

##### handler

[`GestureHandler`](../type-aliases/GestureHandler.md)

#### Returns

() => `void`

***

### onPointerDown()

> **onPointerDown**(`handler`): () => `void`

Defined in: engine/src/systems/PointerSystem.ts:266

#### Parameters

##### handler

[`PointerDownHandler`](../type-aliases/PointerDownHandler.md)

#### Returns

() => `void`

***

### onPointerMove()

> **onPointerMove**(`handler`): () => `void`

Defined in: engine/src/systems/PointerSystem.ts:270

#### Parameters

##### handler

[`PointerMoveHandler`](../type-aliases/PointerMoveHandler.md)

#### Returns

() => `void`

***

### onPointerUp()

> **onPointerUp**(`handler`): () => `void`

Defined in: engine/src/systems/PointerSystem.ts:274

#### Parameters

##### handler

[`PointerUpHandler`](../type-aliases/PointerUpHandler.md)

#### Returns

() => `void`

***

### onWheel()

> **onWheel**(`handler`): () => `void`

Defined in: engine/src/systems/PointerSystem.ts:282

#### Parameters

##### handler

[`WheelHandler`](../type-aliases/WheelHandler.md)

#### Returns

() => `void`

***

### update()

> **update**(): `void`

Defined in: engine/src/systems/PointerSystem.ts:251

Poll for time-based gestures. Call once per frame (like `GamepadSystem.
update()`); this is what fires `longpress` for a pointer held still past
`LONGPRESS_DURATION`. Uses polling rather than `setTimeout` so gesture
timing stays tied to the game loop instead of firing at an arbitrary
wall-clock moment mid-frame.

#### Returns

`void`

[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / PointerSystem

# Class: PointerSystem

Defined in: [engine/src/systems/PointerSystem.ts:140](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PointerSystem.ts#L140)

## Constructors

### Constructor

> **new PointerSystem**(): `PointerSystem`

#### Returns

`PointerSystem`

## Accessors

### pointerCount

#### Get Signature

> **get** **pointerCount**(): `number`

Defined in: [engine/src/systems/PointerSystem.ts:253](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PointerSystem.ts#L253)

##### Returns

`number`

***

### pointers

#### Get Signature

> **get** **pointers**(): readonly [`PointerState`](../interfaces/PointerState.md)[]

Defined in: [engine/src/systems/PointerSystem.ts:257](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PointerSystem.ts#L257)

##### Returns

readonly [`PointerState`](../interfaces/PointerState.md)[]

***

### primaryPointer

#### Get Signature

> **get** **primaryPointer**(): [`PointerState`](../interfaces/PointerState.md) \| `undefined`

Defined in: [engine/src/systems/PointerSystem.ts:267](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PointerSystem.ts#L267)

Primary pointer (mouse, or first touch), if any is active.

##### Returns

[`PointerState`](../interfaces/PointerState.md) \| `undefined`

## Methods

### attach()

> **attach**(`target?`): `void`

Defined in: [engine/src/systems/PointerSystem.ts:159](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PointerSystem.ts#L159)

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

Defined in: [engine/src/systems/PointerSystem.ts:199](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PointerSystem.ts#L199)

Alias for detach() — compatible with SystemManager teardown.

#### Returns

`void`

***

### detach()

> **detach**(): `void`

Defined in: [engine/src/systems/PointerSystem.ts:182](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PointerSystem.ts#L182)

#### Returns

`void`

***

### dispatchPointerCancel()

> **dispatchPointerCancel**(`evt`): `void`

Defined in: [engine/src/systems/PointerSystem.ts:382](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PointerSystem.ts#L382)

#### Parameters

##### evt

###### pointerId

`number`

#### Returns

`void`

***

### dispatchPointerDown()

> **dispatchPointerDown**(`evt`): `void`

Defined in: [engine/src/systems/PointerSystem.ts:292](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PointerSystem.ts#L292)

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

Defined in: [engine/src/systems/PointerSystem.ts:322](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PointerSystem.ts#L322)

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

Defined in: [engine/src/systems/PointerSystem.ts:339](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PointerSystem.ts#L339)

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

### dispatchWheel()

> **dispatchWheel**(`evt`): `void`

Defined in: [engine/src/systems/PointerSystem.ts:394](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PointerSystem.ts#L394)

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

Defined in: [engine/src/systems/PointerSystem.ts:261](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PointerSystem.ts#L261)

#### Parameters

##### id

`number`

#### Returns

[`PointerState`](../interfaces/PointerState.md) \| `undefined`

***

### onGesture()

> **onGesture**(`handler`): () => `void`

Defined in: [engine/src/systems/PointerSystem.ts:237](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PointerSystem.ts#L237)

#### Parameters

##### handler

[`GestureHandler`](../type-aliases/GestureHandler.md)

#### Returns

() => `void`

***

### onPointerDown()

> **onPointerDown**(`handler`): () => `void`

Defined in: [engine/src/systems/PointerSystem.ts:225](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PointerSystem.ts#L225)

#### Parameters

##### handler

[`PointerDownHandler`](../type-aliases/PointerDownHandler.md)

#### Returns

() => `void`

***

### onPointerMove()

> **onPointerMove**(`handler`): () => `void`

Defined in: [engine/src/systems/PointerSystem.ts:229](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PointerSystem.ts#L229)

#### Parameters

##### handler

[`PointerMoveHandler`](../type-aliases/PointerMoveHandler.md)

#### Returns

() => `void`

***

### onPointerUp()

> **onPointerUp**(`handler`): () => `void`

Defined in: [engine/src/systems/PointerSystem.ts:233](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PointerSystem.ts#L233)

#### Parameters

##### handler

[`PointerUpHandler`](../type-aliases/PointerUpHandler.md)

#### Returns

() => `void`

***

### onWheel()

> **onWheel**(`handler`): () => `void`

Defined in: [engine/src/systems/PointerSystem.ts:241](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PointerSystem.ts#L241)

#### Parameters

##### handler

[`WheelHandler`](../type-aliases/WheelHandler.md)

#### Returns

() => `void`

***

### update()

> **update**(): `void`

Defined in: [engine/src/systems/PointerSystem.ts:210](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/PointerSystem.ts#L210)

Poll for time-based gestures. Call once per frame (like `GamepadSystem.
update()`); this is what fires `longpress` for a pointer held still past
`LONGPRESS_DURATION`. Uses polling rather than `setTimeout` so gesture
timing stays tied to the game loop instead of firing at an arbitrary
wall-clock moment mid-frame.

#### Returns

`void`

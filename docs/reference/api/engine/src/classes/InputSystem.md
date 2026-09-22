[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / InputSystem

# Class: InputSystem

Defined in: [engine/src/systems/InputSystem.ts:20](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/InputSystem.ts#L20)

## Constructors

### Constructor

> **new InputSystem**(): `InputSystem`

#### Returns

`InputSystem`

## Accessors

### mouseDX

#### Get Signature

> **get** **mouseDX**(): `number`

Defined in: [engine/src/systems/InputSystem.ts:144](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/InputSystem.ts#L144)

##### Returns

`number`

***

### mouseDY

#### Get Signature

> **get** **mouseDY**(): `number`

Defined in: [engine/src/systems/InputSystem.ts:147](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/InputSystem.ts#L147)

##### Returns

`number`

***

### mouseX

#### Get Signature

> **get** **mouseX**(): `number`

Defined in: [engine/src/systems/InputSystem.ts:138](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/InputSystem.ts#L138)

##### Returns

`number`

***

### mouseY

#### Get Signature

> **get** **mouseY**(): `number`

Defined in: [engine/src/systems/InputSystem.ts:141](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/InputSystem.ts#L141)

##### Returns

`number`

***

### primaryTouch

#### Get Signature

> **get** **primaryTouch**(): [`TouchPoint`](../interfaces/TouchPoint.md) \| `undefined`

Defined in: [engine/src/systems/InputSystem.ts:185](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/InputSystem.ts#L185)

Primary touch (lowest id, or undefined if no touches).

##### Returns

[`TouchPoint`](../interfaces/TouchPoint.md) \| `undefined`

***

### touchCount

#### Get Signature

> **get** **touchCount**(): `number`

Defined in: [engine/src/systems/InputSystem.ts:170](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/InputSystem.ts#L170)

Number of active touch points.

##### Returns

`number`

***

### touches

#### Get Signature

> **get** **touches**(): readonly [`TouchPoint`](../interfaces/TouchPoint.md)[]

Defined in: [engine/src/systems/InputSystem.ts:175](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/InputSystem.ts#L175)

All currently active touch points.

##### Returns

readonly [`TouchPoint`](../interfaces/TouchPoint.md)[]

## Methods

### attach()

> **attach**(`target?`): `void`

Defined in: [engine/src/systems/InputSystem.ts:43](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/InputSystem.ts#L43)

#### Parameters

##### target?

`EventTarget` = `window`

#### Returns

`void`

***

### destroy()

> **destroy**(): `void`

Defined in: [engine/src/systems/InputSystem.ts:272](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/InputSystem.ts#L272)

Alias for `detach()` — compatible with SystemManager teardown.

#### Returns

`void`

***

### detach()

> **detach**(): `void`

Defined in: [engine/src/systems/InputSystem.ts:60](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/InputSystem.ts#L60)

#### Returns

`void`

***

### flush()

> **flush**(): `void`

Defined in: [engine/src/systems/InputSystem.ts:76](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/InputSystem.ts#L76)

Call at end of each frame to flush pressed/released states.

#### Returns

`void`

***

### getTouch()

> **getTouch**(`id`): [`TouchPoint`](../interfaces/TouchPoint.md) \| `undefined`

Defined in: [engine/src/systems/InputSystem.ts:180](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/InputSystem.ts#L180)

Returns the active touch with the given pointer id, or `undefined` if no touch with that id is currently down.

#### Parameters

##### id

`number`

#### Returns

[`TouchPoint`](../interfaces/TouchPoint.md) \| `undefined`

***

### isKeyDown()

> **isKeyDown**(`code`): `boolean`

Defined in: [engine/src/systems/InputSystem.ts:98](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/InputSystem.ts#L98)

#### Parameters

##### code

`string`

#### Returns

`boolean`

***

### isKeyPressed()

> **isKeyPressed**(`code`): `boolean`

Defined in: [engine/src/systems/InputSystem.ts:101](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/InputSystem.ts#L101)

#### Parameters

##### code

`string`

#### Returns

`boolean`

***

### isKeyReleased()

> **isKeyReleased**(`code`): `boolean`

Defined in: [engine/src/systems/InputSystem.ts:104](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/InputSystem.ts#L104)

#### Parameters

##### code

`string`

#### Returns

`boolean`

***

### isMouseDown()

> **isMouseDown**(`button?`): `boolean`

Defined in: [engine/src/systems/InputSystem.ts:151](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/InputSystem.ts#L151)

#### Parameters

##### button?

`number` = `0`

#### Returns

`boolean`

***

### isMousePressed()

> **isMousePressed**(`button?`): `boolean`

Defined in: [engine/src/systems/InputSystem.ts:154](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/InputSystem.ts#L154)

#### Parameters

##### button?

`number` = `0`

#### Returns

`boolean`

***

### isMouseReleased()

> **isMouseReleased**(`button?`): `boolean`

Defined in: [engine/src/systems/InputSystem.ts:160](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/InputSystem.ts#L160)

#### Parameters

##### button?

`number` = `0`

#### Returns

`boolean`

***

### isTouchEnded()

> **isTouchEnded**(`id?`): `boolean`

Defined in: [engine/src/systems/InputSystem.ts:201](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/InputSystem.ts#L201)

True if a touch ended on this frame.

#### Parameters

##### id?

`number`

#### Returns

`boolean`

***

### isTouchStarted()

> **isTouchStarted**(`id?`): `boolean`

Defined in: [engine/src/systems/InputSystem.ts:194](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/InputSystem.ts#L194)

True if a new touch started on this frame.

#### Parameters

##### id?

`number`

#### Returns

`boolean`

***

### simulateKeyDown()

> **simulateKeyDown**(`code`): `void`

Defined in: [engine/src/systems/InputSystem.ts:127](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/InputSystem.ts#L127)

Test-only, non-DOM input injection. Drives the same internal state a
real `keydown`/`keyup` event would, without constructing a
`KeyboardEvent` or touching `window` — this is what keeps input testable
under a headless Node harness (CLAUDE.md's engine-environment-boundary
rule: no DOM dependency on this path).

#### Parameters

##### code

`string`

#### Returns

`void`

***

### simulateKeyUp()

> **simulateKeyUp**(`code`): `void`

Defined in: [engine/src/systems/InputSystem.ts:132](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/InputSystem.ts#L132)

See `simulateKeyDown`.

#### Parameters

##### code

`string`

#### Returns

`void`

***

### snapshotKeys()

> **snapshotKeys**(): `ReadonlyMap`\<`string`, `boolean`\>

Defined in: [engine/src/systems/InputSystem.ts:116](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/InputSystem.ts#L116)

A point-in-time copy of every key currently tracked. Used by
`v2/Input.ts`'s `InputManager.snapshot()` to freeze keyboard state for
a frame (ENGINE_DESIGN.md §4 step 1) — reading this once and caching
the result, rather than reading `isKeyDown` live, is what makes
"polled once, frozen for the frame" true even though this class itself
updates `_keys` continuously as DOM events arrive.

#### Returns

`ReadonlyMap`\<`string`, `boolean`\>

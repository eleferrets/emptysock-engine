[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / InputSystem

# Class: InputSystem

Defined in: engine/src/systems/InputSystem.ts:5

## Constructors

### Constructor

> **new InputSystem**(): `InputSystem`

#### Returns

`InputSystem`

## Properties

### layout

> `readonly` **layout**: [`KeyboardLayout`](KeyboardLayout.md)

Defined in: engine/src/systems/InputSystem.ts:16

Layout translation layer (host-injected provider plus keydown learning).
Key state itself stays keyed by physical `code`; this only answers
"which code types this character".

## Methods

### attach()

> **attach**(`target?`): `void`

Defined in: engine/src/systems/InputSystem.ts:28

Keyboard-only. Mouse and touch used to be tracked here too, but had zero
real consumers outside this file (confirmed by a real-usage audit) and
duplicated what `PointerSystem` already does better — a real Pointer
Events-based unification of mouse/touch/pen plus tap/longpress/swipe/
pinch gesture recognition. `ecs/Input.ts`'s `InputManager` now wraps
`PointerSystem` directly for all of that; this class stays keyboard-only.

#### Parameters

##### target?

`EventTarget` = `window`

#### Returns

`void`

***

### destroy()

> **destroy**(): `void`

Defined in: engine/src/systems/InputSystem.ts:115

Alias for `detach()` — compatible with SystemManager teardown.

#### Returns

`void`

***

### detach()

> **detach**(): `void`

Defined in: engine/src/systems/InputSystem.ts:34

#### Returns

`void`

***

### flush()

> **flush**(): `void`

Defined in: engine/src/systems/InputSystem.ts:43

Call at end of each frame to flush pressed/released states.

#### Returns

`void`

***

### isKeyDown()

> **isKeyDown**(`code`): `boolean`

Defined in: engine/src/systems/InputSystem.ts:50

#### Parameters

##### code

`string`

#### Returns

`boolean`

***

### isKeyPressed()

> **isKeyPressed**(`code`): `boolean`

Defined in: engine/src/systems/InputSystem.ts:53

#### Parameters

##### code

`string`

#### Returns

`boolean`

***

### isKeyReleased()

> **isKeyReleased**(`code`): `boolean`

Defined in: engine/src/systems/InputSystem.ts:56

#### Parameters

##### code

`string`

#### Returns

`boolean`

***

### simulateKeyDown()

> **simulateKeyDown**(`code`, `key?`): `void`

Defined in: engine/src/systems/InputSystem.ts:79

Test-only, non-DOM input injection. Drives the same internal state a
real `keydown`/`keyup` event would, without constructing a
`KeyboardEvent` or touching `window` — this is what keeps input testable
under a headless Node harness (CLAUDE.md's engine-environment-boundary
rule: no DOM dependency on this path).

#### Parameters

##### code

`string`

##### key?

`string`

#### Returns

`void`

***

### simulateKeyUp()

> **simulateKeyUp**(`code`): `void`

Defined in: engine/src/systems/InputSystem.ts:87

See `simulateKeyDown`.

#### Parameters

##### code

`string`

#### Returns

`void`

***

### snapshotKeys()

> **snapshotKeys**(): `ReadonlyMap`\<`string`, `boolean`\>

Defined in: engine/src/systems/InputSystem.ts:68

A point-in-time copy of every key currently tracked. Used by
`ecs/Input.ts`'s `InputManager.snapshot()` to freeze keyboard state for
a frame — reading this once and caching
the result, rather than reading `isKeyDown` live, is what makes
"polled once, frozen for the frame" true even though this class itself
updates `_keys` continuously as DOM events arrive.

#### Returns

`ReadonlyMap`\<`string`, `boolean`\>

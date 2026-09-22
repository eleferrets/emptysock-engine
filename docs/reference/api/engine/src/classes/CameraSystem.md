[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / CameraSystem

# Class: CameraSystem

Defined in: [engine/src/systems/CameraSystem.ts:19](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/CameraSystem.ts#L19)

## Constructors

### Constructor

> **new CameraSystem**(): `CameraSystem`

#### Returns

`CameraSystem`

## Accessors

### state

#### Get Signature

> **get** **state**(): [`CameraState`](../interfaces/CameraState.md)

Defined in: [engine/src/systems/CameraSystem.ts:48](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/CameraSystem.ts#L48)

##### Returns

[`CameraState`](../interfaces/CameraState.md)

***

### viewHeight

#### Get Signature

> **get** **viewHeight**(): `number`

Defined in: [engine/src/systems/CameraSystem.ts:69](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/CameraSystem.ts#L69)

##### Returns

`number`

***

### viewWidth

#### Get Signature

> **get** **viewWidth**(): `number`

Defined in: [engine/src/systems/CameraSystem.ts:66](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/CameraSystem.ts#L66)

##### Returns

`number`

***

### viewX

#### Get Signature

> **get** **viewX**(): `number`

Defined in: [engine/src/systems/CameraSystem.ts:60](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/CameraSystem.ts#L60)

##### Returns

`number`

***

### viewY

#### Get Signature

> **get** **viewY**(): `number`

Defined in: [engine/src/systems/CameraSystem.ts:63](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/CameraSystem.ts#L63)

##### Returns

`number`

## Methods

### attach()

> **attach**(`stage`): `void`

Defined in: [engine/src/systems/CameraSystem.ts:38](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/CameraSystem.ts#L38)

Attach the PixiJS stage container that the camera will transform.

#### Parameters

##### stage

`Container`

#### Returns

`void`

***

### destroy()

> **destroy**(): `void`

Defined in: [engine/src/systems/CameraSystem.ts:222](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/CameraSystem.ts#L222)

#### Returns

`void`

***

### moveTo()

> **moveTo**(`x`, `y`): `void`

Defined in: [engine/src/systems/CameraSystem.ts:83](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/CameraSystem.ts#L83)

Smoothly move toward world position (x, y). Clears any active follow target.

#### Parameters

##### x

`number`

##### y

`number`

#### Returns

`void`

***

### screenToWorld()

> **screenToWorld**(`sx`, `sy`): `object`

Defined in: [engine/src/systems/CameraSystem.ts:161](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/CameraSystem.ts#L161)

Convert a screen-space pixel position to world-space coordinates.
Useful for click / touch hit detection against world objects.

#### Parameters

##### sx

`number`

##### sy

`number`

#### Returns

`object`

##### x

> **x**: `number`

##### y

> **y**: `number`

***

### setBounds()

> **setBounds**(`bounds`): `void`

Defined in: [engine/src/systems/CameraSystem.ts:136](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/CameraSystem.ts#L136)

Clamp the camera position to a world-space rectangle.
Pass `null` to remove clamping.
The camera's visible half-size is taken into account so the view never
shows outside the bounds when zoom is 1.

#### Parameters

##### bounds

[`CameraBounds`](../interfaces/CameraBounds.md) \| `null`

#### Returns

`void`

***

### setFollow()

> **setFollow**(`fn`): `void`

Defined in: [engine/src/systems/CameraSystem.ts:97](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/CameraSystem.ts#L97)

Follow a moving target each frame.
Provide a function that returns the current world {x, y} of the target.
The camera will smoothly track it using the current lerpFactor.

  camera.setFollow(() => player.transform.position);
  camera.setFollow(null); // stop following

#### Parameters

##### fn

(() => `object`) \| `null`

#### Returns

`void`

***

### setLerpFactor()

> **setLerpFactor**(`factor`): `void`

Defined in: [engine/src/systems/CameraSystem.ts:126](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/CameraSystem.ts#L126)

Set the lerp factor used for smooth follow / moveTo.
This is expressed as a per-second fraction — the camera closes
`factor * 100 %` of the remaining distance every second.
Use 1.0 for instant tracking, 0.05 for very slow drift.

#### Parameters

##### factor

`number`

#### Returns

`void`

***

### setRotation()

> **setRotation**(`radians`): `void`

Defined in: [engine/src/systems/CameraSystem.ts:110](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/CameraSystem.ts#L110)

#### Parameters

##### radians

`number`

#### Returns

`void`

***

### setViewSize()

> **setViewSize**(`width`, `height`): `void`

Defined in: [engine/src/systems/CameraSystem.ts:43](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/CameraSystem.ts#L43)

Set the logical viewport size (used by worldToScreen / screenToWorld).

#### Parameters

##### width

`number`

##### height

`number`

#### Returns

`void`

***

### shake()

> **shake**(`intensity`, `duration`): `void`

Defined in: [engine/src/systems/CameraSystem.ts:114](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/CameraSystem.ts#L114)

#### Parameters

##### intensity

`number`

##### duration

`number`

#### Returns

`void`

***

### snapTo()

> **snapTo**(`x`, `y`): `void`

Defined in: [engine/src/systems/CameraSystem.ts:74](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/CameraSystem.ts#L74)

Pan immediately to world position (x, y). Clears any active follow target.

#### Parameters

##### x

`number`

##### y

`number`

#### Returns

`void`

***

### snapZoom()

> **snapZoom**(`zoom`): `void`

Defined in: [engine/src/systems/CameraSystem.ts:105](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/CameraSystem.ts#L105)

#### Parameters

##### zoom

`number`

#### Returns

`void`

***

### update()

> **update**(`deltaTime`): `void`

Defined in: [engine/src/systems/CameraSystem.ts:174](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/CameraSystem.ts#L174)

#### Parameters

##### deltaTime

`number`

#### Returns

`void`

***

### worldToScreen()

> **worldToScreen**(`wx`, `wy`): `object`

Defined in: [engine/src/systems/CameraSystem.ts:144](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/CameraSystem.ts#L144)

Convert a world-space position to screen-space pixel coordinates.
Useful for UI elements that must track world objects.

#### Parameters

##### wx

`number`

##### wy

`number`

#### Returns

`object`

##### x

> **x**: `number`

##### y

> **y**: `number`

***

### zoomTo()

> **zoomTo**(`zoom`): `void`

Defined in: [engine/src/systems/CameraSystem.ts:101](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/CameraSystem.ts#L101)

#### Parameters

##### zoom

`number`

#### Returns

`void`

[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / GamepadSystem

# Class: GamepadSystem

Defined in: engine/src/systems/GamepadSystem.ts:24

## Constructors

### Constructor

> **new GamepadSystem**(): `GamepadSystem`

#### Returns

`GamepadSystem`

## Methods

### getState()

> **getState**(`index`): [`GamepadState`](../interfaces/GamepadState.md) \| `null`

Defined in: engine/src/systems/GamepadSystem.ts:49

#### Parameters

##### index

`number`

#### Returns

[`GamepadState`](../interfaces/GamepadState.md) \| `null`

***

### rumble()

> **rumble**(`index`, `intensity`, `duration`): `void`

Defined in: engine/src/systems/GamepadSystem.ts:53

#### Parameters

##### index

`number`

##### intensity

`number`

##### duration

`number`

#### Returns

`void`

***

### rumbleDual()

> **rumbleDual**(`index`, `opts`): `void`

Defined in: engine/src/systems/GamepadSystem.ts:66

#### Parameters

##### index

`number`

##### opts

[`DualRumbleOptions`](../interfaces/DualRumbleOptions.md)

#### Returns

`void`

***

### update()

> **update**(): `void`

Defined in: engine/src/systems/GamepadSystem.ts:27

#### Returns

`void`

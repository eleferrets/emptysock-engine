[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / GamepadSystem

# Class: GamepadSystem

Defined in: [engine/src/systems/GamepadSystem.ts:24](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/GamepadSystem.ts#L24)

## Constructors

### Constructor

> **new GamepadSystem**(): `GamepadSystem`

#### Returns

`GamepadSystem`

## Methods

### getState()

> **getState**(`index`): [`GamepadState`](../interfaces/GamepadState.md) \| `null`

Defined in: [engine/src/systems/GamepadSystem.ts:49](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/GamepadSystem.ts#L49)

#### Parameters

##### index

`number`

#### Returns

[`GamepadState`](../interfaces/GamepadState.md) \| `null`

***

### rumble()

> **rumble**(`index`, `intensity`, `duration`): `void`

Defined in: [engine/src/systems/GamepadSystem.ts:53](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/GamepadSystem.ts#L53)

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

Defined in: [engine/src/systems/GamepadSystem.ts:66](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/GamepadSystem.ts#L66)

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

Defined in: [engine/src/systems/GamepadSystem.ts:27](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/GamepadSystem.ts#L27)

#### Returns

`void`

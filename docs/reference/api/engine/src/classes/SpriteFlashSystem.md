[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / SpriteFlashSystem

# Class: SpriteFlashSystem

Defined in: engine/src/systems/SpriteFlashSystem.ts:11

Advances every active `SpriteFlash`. Pure component maths, no renderer
types: `amount` falls from `peak` to 0 over `duration` seconds and the
flash deactivates when done. Called once per frame by `Game.update()`.

## Constructors

### Constructor

> **new SpriteFlashSystem**(): `SpriteFlashSystem`

#### Returns

`SpriteFlashSystem`

## Methods

### update()

> **update**(`scene`, `dt`): `void`

Defined in: engine/src/systems/SpriteFlashSystem.ts:12

#### Parameters

##### scene

[`Scene`](Scene.md)

##### dt

`number`

#### Returns

`void`

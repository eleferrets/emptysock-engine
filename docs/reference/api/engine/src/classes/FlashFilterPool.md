[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / FlashFilterPool

# Class: FlashFilterPool

Defined in: engine/src/systems/SpriteFlashSystem.ts:32

Pool of `pixi-filters` `ColorOverlayFilter`s (single pass, alpha-preserving,
`color` + `alpha` uniforms). A filter is only checked out while a sprite is
mid-flash, so idle sprites carry no filter and cost nothing.

## Constructors

### Constructor

> **new FlashFilterPool**(): `FlashFilterPool`

#### Returns

`FlashFilterPool`

## Accessors

### freeCount

#### Get Signature

> **get** **freeCount**(): `number`

Defined in: engine/src/systems/SpriteFlashSystem.ts:59

Filters idle in the pool.

##### Returns

`number`

***

### liveCount

#### Get Signature

> **get** **liveCount**(): `number`

Defined in: engine/src/systems/SpriteFlashSystem.ts:54

Filters currently checked out.

##### Returns

`number`

## Methods

### acquire()

> **acquire**(`color`, `amount`): `ColorOverlayFilter`

Defined in: engine/src/systems/SpriteFlashSystem.ts:36

#### Parameters

##### color

`number`

##### amount

`number`

#### Returns

`ColorOverlayFilter`

***

### configure()

> **configure**(`f`, `color`, `amount`): `void`

Defined in: engine/src/systems/SpriteFlashSystem.ts:43

#### Parameters

##### f

`ColorOverlayFilter`

##### color

`number`

##### amount

`number`

#### Returns

`void`

***

### release()

> **release**(`f`): `void`

Defined in: engine/src/systems/SpriteFlashSystem.ts:48

#### Parameters

##### f

`ColorOverlayFilter`

#### Returns

`void`

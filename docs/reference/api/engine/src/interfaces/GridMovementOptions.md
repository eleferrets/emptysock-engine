[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / GridMovementOptions

# Interface: GridMovementOptions

Defined in: [engine/src/behaviors/GridMovementBehavior.ts:5](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/behaviors/GridMovementBehavior.ts#L5)

## Properties

### input

> **input**: [`InputSystem`](../classes/InputSystem.md)

Defined in: [engine/src/behaviors/GridMovementBehavior.ts:11](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/behaviors/GridMovementBehavior.ts#L11)

InputSystem instance.

***

### isSolid?

> `optional` **isSolid?**: (`tileX`, `tileY`) => `boolean`

Defined in: [engine/src/behaviors/GridMovementBehavior.ts:13](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/behaviors/GridMovementBehavior.ts#L13)

Optional collision check: return true if the tile at (tileX, tileY) is solid.

#### Parameters

##### tileX

`number`

##### tileY

`number`

#### Returns

`boolean`

***

### speed?

> `optional` **speed?**: `number`

Defined in: [engine/src/behaviors/GridMovementBehavior.ts:9](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/behaviors/GridMovementBehavior.ts#L9)

Movement speed in tiles per second. Default 4.

***

### tileSize?

> `optional` **tileSize?**: `number`

Defined in: [engine/src/behaviors/GridMovementBehavior.ts:7](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/behaviors/GridMovementBehavior.ts#L7)

Size of one tile in pixels. Default 32.

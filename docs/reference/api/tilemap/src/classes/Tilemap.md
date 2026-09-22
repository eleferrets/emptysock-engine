[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [tilemap/src](../README.md) / Tilemap

# Class: Tilemap

Defined in: [tilemap/src/TilemapSystem.ts:43](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/tilemap/src/TilemapSystem.ts#L43)

## Constructors

### Constructor

> **new Tilemap**(`data`, `entity`): `Tilemap`

Defined in: [tilemap/src/TilemapSystem.ts:48](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/tilemap/src/TilemapSystem.ts#L48)

#### Parameters

##### data

[`TilemapData`](../interfaces/TilemapData.md)

##### entity

`Entity`

#### Returns

`Tilemap`

## Properties

### data

> `readonly` **data**: [`TilemapData`](../interfaces/TilemapData.md)

Defined in: [tilemap/src/TilemapSystem.ts:44](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/tilemap/src/TilemapSystem.ts#L44)

***

### entity

> `readonly` **entity**: `Entity`

Defined in: [tilemap/src/TilemapSystem.ts:45](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/tilemap/src/TilemapSystem.ts#L45)

## Accessors

### height

#### Get Signature

> **get** **height**(): `number`

Defined in: [tilemap/src/TilemapSystem.ts:57](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/tilemap/src/TilemapSystem.ts#L57)

##### Returns

`number`

***

### width

#### Get Signature

> **get** **width**(): `number`

Defined in: [tilemap/src/TilemapSystem.ts:54](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/tilemap/src/TilemapSystem.ts#L54)

##### Returns

`number`

## Methods

### asGrid()

> **asGrid**(): `boolean`[][]

Defined in: [tilemap/src/TilemapSystem.ts:66](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/tilemap/src/TilemapSystem.ts#L66)

Return all solid cells across all layers as a flat walkability grid (true = walkable).

#### Returns

`boolean`[][]

***

### getLayer()

> **getLayer**(`name`): [`TilemapLayer`](../interfaces/TilemapLayer.md) \| `undefined`

Defined in: [tilemap/src/TilemapSystem.ts:61](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/tilemap/src/TilemapSystem.ts#L61)

#### Parameters

##### name

`string`

#### Returns

[`TilemapLayer`](../interfaces/TilemapLayer.md) \| `undefined`

***

### tileAt()

> **tileAt**(`worldX`, `worldY`, `layerName`): [`TileCell`](../interfaces/TileCell.md) \| `null`

Defined in: [tilemap/src/TilemapSystem.ts:87](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/tilemap/src/TilemapSystem.ts#L87)

World-space tile at (x, y).

#### Parameters

##### worldX

`number`

##### worldY

`number`

##### layerName

`string`

#### Returns

[`TileCell`](../interfaces/TileCell.md) \| `null`

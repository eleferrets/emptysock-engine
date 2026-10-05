[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [tilemap/src](../README.md) / Tilemap

# Class: Tilemap

Defined in: tilemap/src/TilemapSystem.ts:43

## Constructors

### Constructor

> **new Tilemap**(`data`): `Tilemap`

Defined in: tilemap/src/TilemapSystem.ts:55

#### Parameters

##### data

[`TilemapData`](../interfaces/TilemapData.md)

#### Returns

`Tilemap`

## Properties

### data

> `readonly` **data**: [`TilemapData`](../interfaces/TilemapData.md)

Defined in: tilemap/src/TilemapSystem.ts:44

## Accessors

### entity

#### Get Signature

> **get** **entity**(): `Entity` \| `null`

Defined in: tilemap/src/TilemapSystem.ts:60

##### Returns

`Entity` \| `null`

***

### height

#### Get Signature

> **get** **height**(): `number`

Defined in: tilemap/src/TilemapSystem.ts:72

##### Returns

`number`

***

### width

#### Get Signature

> **get** **width**(): `number`

Defined in: tilemap/src/TilemapSystem.ts:69

##### Returns

`number`

## Methods

### asGrid()

> **asGrid**(): `boolean`[][]

Defined in: tilemap/src/TilemapSystem.ts:81

Return all solid cells across all layers as a flat walkability grid (true = walkable).

#### Returns

`boolean`[][]

***

### getLayer()

> **getLayer**(`name`): [`TilemapLayer`](../interfaces/TilemapLayer.md) \| `undefined`

Defined in: tilemap/src/TilemapSystem.ts:76

#### Parameters

##### name

`string`

#### Returns

[`TilemapLayer`](../interfaces/TilemapLayer.md) \| `undefined`

***

### tileAt()

> **tileAt**(`worldX`, `worldY`, `layerName`): [`TileCell`](../interfaces/TileCell.md) \| `null`

Defined in: tilemap/src/TilemapSystem.ts:102

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

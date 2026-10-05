[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [tilemap/src](../README.md) / AutoTileSystem

# Class: AutoTileSystem

Defined in: tilemap/src/AutoTileSystem.ts:50

## Constructors

### Constructor

> **new AutoTileSystem**(): `AutoTileSystem`

#### Returns

`AutoTileSystem`

## Methods

### addRuleSet()

> **addRuleSet**(`ruleSet`): `void`

Defined in: tilemap/src/AutoTileSystem.ts:55

#### Parameters

##### ruleSet

[`AutoTileRuleSet`](../interfaces/AutoTileRuleSet.md)

#### Returns

`void`

***

### applyToLayer()

> **applyToLayer**(`data`, `baseTileIndex`): `void`

Defined in: tilemap/src/AutoTileSystem.ts:108

Re-resolve all cells in a layer that use this base tile type.
data: "col,row" -> tileIndex map (mutated in-place).

#### Parameters

##### data

`Record`\<`string`, `number`\>

##### baseTileIndex

`number`

#### Returns

`void`

***

### fromJSON()

> **fromJSON**(`ruleSets`): `void`

Defined in: tilemap/src/AutoTileSystem.ts:138

#### Parameters

##### ruleSets

[`AutoTileRuleSet`](../interfaces/AutoTileRuleSet.md)[]

#### Returns

`void`

***

### getRuleSet()

> **getRuleSet**(`baseTileIndex`): [`AutoTileRuleSet`](../interfaces/AutoTileRuleSet.md) \| `undefined`

Defined in: tilemap/src/AutoTileSystem.ts:67

#### Parameters

##### baseTileIndex

`number`

#### Returns

[`AutoTileRuleSet`](../interfaces/AutoTileRuleSet.md) \| `undefined`

***

### removeRuleSet()

> **removeRuleSet**(`baseTileIndex`): `void`

Defined in: tilemap/src/AutoTileSystem.ts:62

#### Parameters

##### baseTileIndex

`number`

#### Returns

`void`

***

### resolve()

> **resolve**(`col`, `row`, `baseTileIndex`, `tileAt`): `number`

Defined in: tilemap/src/AutoTileSystem.ts:75

Resolve the correct tile variant for the cell at (col, row).
tileAt is a callback returning the tile index at that cell, or -1 if empty.

#### Parameters

##### col

`number`

##### row

`number`

##### baseTileIndex

`number`

##### tileAt

(`col`, `row`) => `number`

#### Returns

`number`

***

### toJSON()

> **toJSON**(): [`AutoTileRuleSet`](../interfaces/AutoTileRuleSet.md)[]

Defined in: tilemap/src/AutoTileSystem.ts:134

#### Returns

[`AutoTileRuleSet`](../interfaces/AutoTileRuleSet.md)[]

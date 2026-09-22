[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / AutoTileSystem

# Class: AutoTileSystem

Defined in: [engine/src/systems/AutoTileSystem.ts:37](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/AutoTileSystem.ts#L37)

## Constructors

### Constructor

> **new AutoTileSystem**(): `AutoTileSystem`

#### Returns

`AutoTileSystem`

## Methods

### addRuleSet()

> **addRuleSet**(`ruleSet`): `void`

Defined in: [engine/src/systems/AutoTileSystem.ts:42](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/AutoTileSystem.ts#L42)

#### Parameters

##### ruleSet

[`AutoTileRuleSet`](../interfaces/AutoTileRuleSet.md)

#### Returns

`void`

***

### applyToLayer()

> **applyToLayer**(`data`, `baseTileIndex`): `void`

Defined in: [engine/src/systems/AutoTileSystem.ts:95](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/AutoTileSystem.ts#L95)

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

Defined in: [engine/src/systems/AutoTileSystem.ts:125](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/AutoTileSystem.ts#L125)

#### Parameters

##### ruleSets

[`AutoTileRuleSet`](../interfaces/AutoTileRuleSet.md)[]

#### Returns

`void`

***

### getRuleSet()

> **getRuleSet**(`baseTileIndex`): [`AutoTileRuleSet`](../interfaces/AutoTileRuleSet.md) \| `undefined`

Defined in: [engine/src/systems/AutoTileSystem.ts:54](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/AutoTileSystem.ts#L54)

#### Parameters

##### baseTileIndex

`number`

#### Returns

[`AutoTileRuleSet`](../interfaces/AutoTileRuleSet.md) \| `undefined`

***

### removeRuleSet()

> **removeRuleSet**(`baseTileIndex`): `void`

Defined in: [engine/src/systems/AutoTileSystem.ts:49](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/AutoTileSystem.ts#L49)

#### Parameters

##### baseTileIndex

`number`

#### Returns

`void`

***

### resolve()

> **resolve**(`col`, `row`, `baseTileIndex`, `tileAt`): `number`

Defined in: [engine/src/systems/AutoTileSystem.ts:62](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/AutoTileSystem.ts#L62)

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

Defined in: [engine/src/systems/AutoTileSystem.ts:121](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/AutoTileSystem.ts#L121)

#### Returns

[`AutoTileRuleSet`](../interfaces/AutoTileRuleSet.md)[]

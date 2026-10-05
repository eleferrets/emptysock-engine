[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / TileLayerSource

# Interface: TileLayerSource

Defined in: engine/src/systems/RenderPipeline.ts:74

The subset of `@emptysock/tilemap`'s `Tilemap` shape that `RenderPipeline`
actually reads. `RenderPipeline` lives in the core engine and must not
depend on the optional `@emptysock/tilemap` module package (§13.1), so it
depends on this structural interface instead — `Tilemap` satisfies it
without either package importing the other. Only `mountTilemap()`'s
caller (game code that already imports `@emptysock/tilemap`) needs both
types in scope at once.

## Properties

### data

> `readonly` **data**: `object`

Defined in: engine/src/systems/RenderPipeline.ts:75

#### cols

> `readonly` **cols**: `number`

#### layers

> `readonly` **layers**: readonly `object`[]

#### rows

> `readonly` **rows**: `number`

#### tileHeight

> `readonly` **tileHeight**: `number`

#### tileset

> `readonly` **tileset**: `object`

##### tileset.columns

> `readonly` **columns**: `number`

##### tileset.imagePath

> `readonly` **imagePath**: `string`

##### tileset.margin?

> `readonly` `optional` **margin?**: `number`

##### tileset.spacing?

> `readonly` `optional` **spacing?**: `number`

##### tileset.tileHeight

> `readonly` **tileHeight**: `number`

##### tileset.tileWidth

> `readonly` **tileWidth**: `number`

#### tileWidth

> `readonly` **tileWidth**: `number`

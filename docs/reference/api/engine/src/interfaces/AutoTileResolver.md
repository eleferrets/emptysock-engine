[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / AutoTileResolver

# Interface: AutoTileResolver

Defined in: engine/src/systems/RenderPipeline.ts:57

The minimal shape `mountTilemap()` needs from an auto-tile resolver — just
the one `resolve()` method it actually calls. `@emptysock/tilemap`'s
`AutoTileSystem` satisfies this without either package importing the
other, the same "engine depends on the interface, never a concrete
implementation" pattern as `TileLayerSource`/`Tilemap` below.

## Methods

### resolve()

> **resolve**(`col`, `row`, `baseTileIndex`, `tileAt`): `number`

Defined in: engine/src/systems/RenderPipeline.ts:58

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

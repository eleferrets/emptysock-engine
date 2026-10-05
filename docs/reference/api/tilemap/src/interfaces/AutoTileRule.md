[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [tilemap/src](../README.md) / AutoTileRule

# Interface: AutoTileRule

Defined in: tilemap/src/AutoTileSystem.ts:23

Auto-tile rule system — selects a tile variant based on neighbour occupancy.

A rule set is attached to a tileset. Each rule maps a neighbour bitmask
(8-bit: NW|N|NE|W|E|SW|S|SE) to a tile index in the tileset.
The painter calls resolve() with the 8-bit mask for the target cell and
gets back the tile index to write.

Lives in `@emptysock/tilemap`, not engine core:
it's pure tile-authoring/content logic with zero rendering or ECS
coupling (no pixi, no Scene/Entity, just plain data in and a tile index
out) — the same reasoning that already put `NavMeshSystem` here rather
than in `packages/engine`. `RenderPipeline.mountTilemap()` (in engine
core, since every game needs to render, not just ones with tile levels)
never imports this class directly; it declares its own minimal
`AutoTileResolver` structural interface (just the one `resolve()` method
it actually calls) that this class satisfies without either package
importing the other — the exact same pattern as `TileLayerSource`/
`Tilemap` (see CLAUDE.md's "RenderPipeline mounts a tilemap through a
structural interface" entry).

## Properties

### mask

> **mask**: `number`

Defined in: tilemap/src/AutoTileSystem.ts:25

8-bit neighbour mask; bit=1 means "same tile type present". Bits: 0=NW 1=N 2=NE 3=W 4=E 5=SW 6=S 7=SE

***

### tileIndex

> **tileIndex**: `number`

Defined in: tilemap/src/AutoTileSystem.ts:27

Tile index (into the tileset) to use when this rule matches

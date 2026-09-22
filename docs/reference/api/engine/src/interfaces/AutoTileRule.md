[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / AutoTileRule

# Interface: AutoTileRule

Defined in: [engine/src/systems/AutoTileSystem.ts:10](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/AutoTileSystem.ts#L10)

Auto-tile rule system — selects a tile variant based on neighbour occupancy.

A rule set is attached to a tileset. Each rule maps a neighbour bitmask
(8-bit: NW|N|NE|W|E|SW|S|SE) to a tile index in the tileset.
The painter calls resolve() with the 8-bit mask for the target cell and
gets back the tile index to write.

## Properties

### mask

> **mask**: `number`

Defined in: [engine/src/systems/AutoTileSystem.ts:12](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/AutoTileSystem.ts#L12)

8-bit neighbour mask; bit=1 means "same tile type present". Bits: 0=NW 1=N 2=NE 3=W 4=E 5=SW 6=S 7=SE

***

### tileIndex

> **tileIndex**: `number`

Defined in: [engine/src/systems/AutoTileSystem.ts:14](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/AutoTileSystem.ts#L14)

Tile index (into the tileset) to use when this rule matches

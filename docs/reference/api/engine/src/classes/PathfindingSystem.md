[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / PathfindingSystem

# Class: PathfindingSystem

Defined in: [engine/src/systems/PathfindingSystem.ts:43](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PathfindingSystem.ts#L43)

## Constructors

### Constructor

> **new PathfindingSystem**(): `PathfindingSystem`

#### Returns

`PathfindingSystem`

## Methods

### findPath()

#### Call Signature

> **findPath**(`request`): [`PathResult`](../interfaces/PathResult.md)

Defined in: [engine/src/systems/PathfindingSystem.ts:79](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PathfindingSystem.ts#L79)

Find a path using A*.

Two call signatures:
- `findPath(request)` — full PathRequest; grid is passed inline each call.
- `findPath(from, to)` — shorthand when a grid is attached via `setGrid()`.

##### Parameters

###### request

[`PathRequest`](../interfaces/PathRequest.md)

##### Returns

[`PathResult`](../interfaces/PathResult.md)

#### Call Signature

> **findPath**(`from`, `to`): [`PathResult`](../interfaces/PathResult.md)

Defined in: [engine/src/systems/PathfindingSystem.ts:80](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PathfindingSystem.ts#L80)

Find a path using A*.

Two call signatures:
- `findPath(request)` — full PathRequest; grid is passed inline each call.
- `findPath(from, to)` — shorthand when a grid is attached via `setGrid()`.

##### Parameters

###### from

###### x

`number`

###### y

`number`

###### to

###### x

`number`

###### y

`number`

##### Returns

[`PathResult`](../interfaces/PathResult.md)

***

### setGrid()

> **setGrid**(`grid`, `allowDiagonal?`): `void`

Defined in: [engine/src/systems/PathfindingSystem.ts:62](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PathfindingSystem.ts#L62)

Attach a static grid so `findPath(from, to)` can be called without
passing the grid on every request. Call this once in `onLoad` and then
use the two-argument shorthand for all subsequent pathfinding.

Accepts the `boolean[][]` produced by `Tilemap.asGrid()` directly, or a
`GridCell[][]` when per-cell movement weight is needed.

#### Parameters

##### grid

readonly readonly [`GridCell`](../interfaces/GridCell.md)[][] \| readonly readonly `boolean`[][]

##### allowDiagonal?

`boolean` = `false`

Allow diagonal movement. Default false.

#### Returns

`void`

#### Example

```ts
pf.setGrid(tilemap.asGrid(), true);
// later, in game logic:
const { path } = pf.findPath({ x: 0, y: 0 }, { x: 10, y: 5 });
```

***

### update()

> **update**(`_dt`): `void`

Defined in: [engine/src/systems/PathfindingSystem.ts:147](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/PathfindingSystem.ts#L147)

#### Parameters

##### \_dt

`number`

#### Returns

`void`

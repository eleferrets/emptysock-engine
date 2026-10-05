[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / NavMeshQuerySource

# Interface: NavMeshQuerySource

Defined in: engine/src/bridge/QueryChannel.ts:307

`NavMeshSystem` lives in `@emptysock/tilemap`, which depends on
`@emptysock/engine`, never the other way around — see this file's module
doc comment and CLAUDE.md's "`RenderPipeline` mounts a tilemap through a
structural interface" entry, the exact precedent this follows.
`@emptysock/tilemap`'s `NavMeshSystem` satisfies this shape structurally;
neither package imports the other.

## Methods

### findPath()

> **findPath**(`from`, `to`): [`Vec2`](Vec2.md)[] \| `null`

Defined in: engine/src/bridge/QueryChannel.ts:308

#### Parameters

##### from

[`Vec2`](Vec2.md)

##### to

[`Vec2`](Vec2.md)

#### Returns

[`Vec2`](Vec2.md)[] \| `null`

***

### nearestNode()

> **nearestNode**(`point`): [`Vec2`](Vec2.md) \| `null`

Defined in: engine/src/bridge/QueryChannel.ts:309

#### Parameters

##### point

[`Vec2`](Vec2.md)

#### Returns

[`Vec2`](Vec2.md) \| `null`

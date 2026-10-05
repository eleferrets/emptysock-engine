[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / CreateEntityQuery

# Interface: CreateEntityQuery

Defined in: engine/src/bridge/QueryChannel.ts:158

`scene_create_entity` — spawn a bare entity via `Scene.spawn()`, then
`entity.add()` each named component (already-registered defaults, no
per-field overrides — this is entity creation, not a full prefab spawn).
`tag`, if given, is written as `Meta.name`/`Meta.tags` (adding a `Meta`
component if the entity doesn't have one) rather than invented as a
second, parallel identity concept — see CLAUDE.md's `Meta` component
entry.

## Properties

### components?

> `optional` **components?**: `string`[]

Defined in: engine/src/bridge/QueryChannel.ts:161

***

### kind

> **kind**: `"createEntity"`

Defined in: engine/src/bridge/QueryChannel.ts:159

***

### tag?

> `optional` **tag?**: `string`

Defined in: engine/src/bridge/QueryChannel.ts:160

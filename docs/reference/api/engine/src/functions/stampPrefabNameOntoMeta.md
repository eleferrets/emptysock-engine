[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / stampPrefabNameOntoMeta

# Function: stampPrefabNameOntoMeta()

> **stampPrefabNameOntoMeta**(`entity`, `prefabName`): `void`

Defined in: engine/src/SceneFile.ts:225

Stamps a spawned prefab instance's `Meta.name` with the `PrefabDef` it was
spawned from, when nothing already gave it a name — this is what lets
object-type lookups (anything that
wants "which object type is this instance") resolve a scene's prefab
instances back to their object name, reusing the
one existing "this entity has an editor/tooling-visible name" component
(`Meta`, see CLAUDE.md's `QueryChannel`/`Meta.name`/`Meta.tags` note)
rather than inventing a second identity concept just for this. A prefab
whose own `.prefab.json` already includes a `Meta` component with a real
`name` override wins — this only fills in the gap, it never overwrites an
explicitly-authored name.

## Parameters

### entity

[`Entity`](../classes/Entity.md)

### prefabName

`string`

## Returns

`void`

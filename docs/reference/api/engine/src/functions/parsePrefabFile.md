[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / parsePrefabFile

# Function: parsePrefabFile()

> **parsePrefabFile**(`rawFile`, `lookup`, `resolvePrefab?`): [`PrefabDef`](../interfaces/PrefabDef.md)

Defined in: engine/src/SceneFile.ts:113

Parses a `.prefab.json` file's contents into a runtime `PrefabDef`.
`resolvePrefab` is only needed when `file.extends` is non-empty — it
resolves an extended prefab's *name* back to its already-parsed
`PrefabDef` (typically a small map you build by parsing a project's
prefab files in dependency order, or a second pass once every file's been
parsed once).

## Parameters

### rawFile

[`PrefabFile`](../interfaces/PrefabFile.md) \| [`PrefabFileV1`](../interfaces/PrefabFileV1.md)

### lookup

[`ComponentLookup`](../type-aliases/ComponentLookup.md)

### resolvePrefab?

(`name`) => [`PrefabDef`](../interfaces/PrefabDef.md)

## Returns

[`PrefabDef`](../interfaces/PrefabDef.md)

[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / migratePrefabFile

# Function: migratePrefabFile()

> **migratePrefabFile**(`file`): [`PrefabFile`](../interfaces/PrefabFile.md)

Defined in: engine/src/SceneFile.ts:72

Migrates a prefab file to the current shape. A name-keyed `components`
map is returned as is; the legacy array is converted in order (a
duplicated component name: last entry wins, at its first position).

## Parameters

### file

[`PrefabFile`](../interfaces/PrefabFile.md) \| [`PrefabFileV1`](../interfaces/PrefabFileV1.md)

## Returns

[`PrefabFile`](../interfaces/PrefabFile.md)

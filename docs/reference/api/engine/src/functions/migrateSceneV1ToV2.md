[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / migrateSceneV1ToV2

# Function: migrateSceneV1ToV2()

> **migrateSceneV1ToV2**(`file`): [`SceneDocument`](../interfaces/SceneDocument.md)

Defined in: engine/src/SceneMigrations.ts:169

Migrates a v1 `SceneFile` to a v2 `SceneDocument`. Prefab instances come first, then direct entities (the order v1's `loadSceneFile` spawned). Synthesised ids are `p<i>` / `e<j>`.

## Parameters

### file

[`SceneFileV1`](../interfaces/SceneFileV1.md)

## Returns

[`SceneDocument`](../interfaces/SceneDocument.md)

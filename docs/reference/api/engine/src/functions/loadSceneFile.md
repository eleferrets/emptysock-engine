[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / loadSceneFile

# Function: loadSceneFile()

> **loadSceneFile**(`scene`, `file`, `lookup`, `prefabsByName`, `options?`): [`Entity`](../classes/Entity.md)[]

Defined in: engine/src/SceneFile.ts:237

## Parameters

### scene

[`Scene`](../classes/Scene.md)

### file

[`SceneDocument`](../interfaces/SceneDocument.md) \| [`SceneFileV1`](../interfaces/SceneFileV1.md)

### lookup

[`ComponentLookup`](../type-aliases/ComponentLookup.md)

### prefabsByName

`ReadonlyMap`\<`string`, [`PrefabDef`](../interfaces/PrefabDef.md)\<[`SerializableRecord`](../type-aliases/SerializableRecord.md)\>\>

### options?

[`LoadSceneFileOptions`](../interfaces/LoadSceneFileOptions.md)

## Returns

[`Entity`](../classes/Entity.md)[]

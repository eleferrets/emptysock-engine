[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / SceneFileV1

# Interface: SceneFileV1

Defined in: engine/src/SceneMigrations.ts:55

The pre-`formatVersion` on-disk scene shape. Read via `migrateScene` only; never written.

## Properties

### entities?

> `readonly` `optional` **entities?**: readonly [`SceneFileV1Entity`](SceneFileV1Entity.md)[]

Defined in: engine/src/SceneMigrations.ts:59

***

### persistent?

> `readonly` `optional` **persistent?**: `boolean`

Defined in: engine/src/SceneMigrations.ts:64

***

### prefabInstances?

> `readonly` `optional` **prefabInstances?**: readonly [`SceneFileV1PrefabInstance`](SceneFileV1PrefabInstance.md)[]

Defined in: engine/src/SceneMigrations.ts:58

***

### roomHeight?

> `readonly` `optional` **roomHeight?**: `number`

Defined in: engine/src/SceneMigrations.ts:62

***

### roomWidth?

> `readonly` `optional` **roomWidth?**: `number`

Defined in: engine/src/SceneMigrations.ts:61

***

### sceneName

> `readonly` **sceneName**: `string`

Defined in: engine/src/SceneMigrations.ts:56

***

### systems?

> `readonly` `optional` **systems?**: readonly `string`[]

Defined in: engine/src/SceneMigrations.ts:57

***

### views?

> `readonly` `optional` **views?**: readonly [`SceneFileV1View`](SceneFileV1View.md)[]

Defined in: engine/src/SceneMigrations.ts:63

***

### viewsEnabled?

> `readonly` `optional` **viewsEnabled?**: `boolean`

Defined in: engine/src/SceneMigrations.ts:60

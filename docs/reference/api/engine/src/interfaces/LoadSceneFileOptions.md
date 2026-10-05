[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / LoadSceneFileOptions

# Interface: LoadSceneFileOptions

Defined in: engine/src/SceneFile.ts:187

Options for `loadSceneFile()`.

## Properties

### idMap?

> `optional` **idMap?**: `Map`\<`string`, [`Entity`](../classes/Entity.md)\>

Defined in: engine/src/SceneFile.ts:205

Out-parameter: filled with `SceneEntity.id` -> spawned entity for the
loaded document, so callers can resolve file ids (e.g. a view's
`follow.entity`) after the load.

***

### onSpawned?

> `optional` **onSpawned?**: (`entity`, `sceneEntity?`) => `void`

Defined in: engine/src/SceneFile.ts:206

#### Parameters

##### entity

[`Entity`](../classes/Entity.md)

##### sceneEntity?

[`SceneEntity`](SceneEntity.md)

#### Returns

`void`

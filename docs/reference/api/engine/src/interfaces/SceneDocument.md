[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / SceneDocument

# Interface: SceneDocument

Defined in: engine/src/SceneDocument.ts:103

## Properties

### backgroundColor?

> `readonly` `optional` **backgroundColor?**: `string`

Defined in: engine/src/SceneDocument.ts:109

***

### entities

> `readonly` **entities**: readonly [`SceneEntity`](SceneEntity.md)[]

Defined in: engine/src/SceneDocument.ts:113

***

### formatVersion

> `readonly` **formatVersion**: `2`

Defined in: engine/src/SceneDocument.ts:104

***

### id?

> `readonly` `optional` **id?**: `string`

Defined in: engine/src/SceneDocument.ts:105

***

### metadata?

> `readonly` `optional` **metadata?**: `object`

Defined in: engine/src/SceneDocument.ts:114

#### author?

> `readonly` `optional` **author?**: `string`

#### createdAt?

> `readonly` `optional` **createdAt?**: `number`

#### updatedAt?

> `readonly` `optional` **updatedAt?**: `number`

***

### name

> `readonly` **name**: `string`

Defined in: engine/src/SceneDocument.ts:106

***

### persistent?

> `readonly` `optional` **persistent?**: `boolean`

Defined in: engine/src/SceneDocument.ts:108

Room-level state cache flag (`roomSettings.persistent`).

***

### room?

> `readonly` `optional` **room?**: [`SceneRoom`](SceneRoom.md)

Defined in: engine/src/SceneDocument.ts:112

***

### systems?

> `readonly` `optional` **systems?**: readonly `string`[]

Defined in: engine/src/SceneDocument.ts:111

Module/system names this scene needs (informational for now).

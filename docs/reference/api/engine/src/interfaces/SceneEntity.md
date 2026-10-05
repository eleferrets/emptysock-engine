[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / SceneEntity

# Interface: SceneEntity

Defined in: engine/src/SceneDocument.ts:39

## Properties

### active?

> `readonly` `optional` **active?**: `boolean`

Defined in: engine/src/SceneDocument.ts:46

Maps to `Meta.active`; default true.

***

### components?

> `readonly` `optional` **components?**: `Readonly`\<`Record`\<`string`, [`SceneComponentEntry`](SceneComponentEntry.md)\>\>

Defined in: engine/src/SceneDocument.ts:53

Keyed by `ComponentDef.componentName`; applied after the prefab.

***

### ext?

> `readonly` `optional` **ext?**: `Readonly`\<`Record`\<`string`, `Readonly`\<`Record`\<`string`, `unknown`\>\>\>\>

Defined in: engine/src/SceneDocument.ts:57

Namespaced tool/compat data, e.g. `ext.<namespace>.<key>`.

***

### id

> `readonly` **id**: `string`

Defined in: engine/src/SceneDocument.ts:40

***

### layer?

> `readonly` `optional` **layer?**: `string`

Defined in: engine/src/SceneDocument.ts:54

***

### name?

> `readonly` `optional` **name?**: `string`

Defined in: engine/src/SceneDocument.ts:42

Maps to `Meta.name` (else the prefab name).

***

### parent?

> `readonly` `optional` **parent?**: `string`

Defined in: engine/src/SceneDocument.ts:48

Parent entity id. Validated; not yet acted on by the runtime.

***

### persistent?

> `readonly` `optional` **persistent?**: `boolean`

Defined in: engine/src/SceneDocument.ts:50

Maps to `Meta.persistent` (object-style carry-over across rooms).

***

### pool?

> `readonly` `optional` **pool?**: `boolean`

Defined in: engine/src/SceneDocument.ts:55

***

### prefab?

> `readonly` `optional` **prefab?**: [`ScenePrefabRef`](ScenePrefabRef.md)

Defined in: engine/src/SceneDocument.ts:51

***

### tags?

> `readonly` `optional` **tags?**: readonly `string`[]

Defined in: engine/src/SceneDocument.ts:44

Maps to `Meta.tags`.

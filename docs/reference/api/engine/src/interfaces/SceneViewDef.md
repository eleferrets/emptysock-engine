[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / SceneViewDef

# Interface: SceneViewDef

Defined in: engine/src/SceneDocument.ts:80

One room view (up to 8; index = view slot 0-7).

## Properties

### border?

> `readonly` `optional` **border?**: [`ScenePoint`](ScenePoint.md)

Defined in: engine/src/SceneDocument.ts:85

***

### follow?

> `readonly` `optional` **follow?**: `object`

Defined in: engine/src/SceneDocument.ts:87

#### entity?

> `readonly` `optional` **entity?**: [`EntityRefJson`](EntityRefJson.md)

#### object?

> `readonly` `optional` **object?**: `string`

Object-type name, resolved against `Meta.name` at runtime.

***

### id

> `readonly` **id**: `string`

Defined in: engine/src/SceneDocument.ts:81

***

### screen

> `readonly` **screen**: [`SceneRect`](SceneRect.md)

Defined in: engine/src/SceneDocument.ts:84

***

### speed?

> `readonly` `optional` **speed?**: [`ScenePoint`](ScenePoint.md)

Defined in: engine/src/SceneDocument.ts:86

***

### visible

> `readonly` **visible**: `boolean`

Defined in: engine/src/SceneDocument.ts:82

***

### world

> `readonly` **world**: [`SceneRect`](SceneRect.md)

Defined in: engine/src/SceneDocument.ts:83

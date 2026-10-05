[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / TransferPolicy

# Interface: TransferPolicy

Defined in: engine/src/SceneTransfer.ts:65

## Properties

### extras?

> `readonly` `optional` **extras?**: readonly [`EntityExtra`](EntityExtra.md)\<`unknown`\>[]

Defined in: engine/src/SceneTransfer.ts:69

Per-entity state kept outside components.

***

### remap?

> `readonly` `optional` **remap?**: [`RemapOptions`](RemapOptions.md)

Defined in: engine/src/SceneTransfer.ts:71

Forwarded to the ref remap (default: `console.warn`).

## Methods

### select()

> **select**(`entity`, `scene`): `boolean`

Defined in: engine/src/SceneTransfer.ts:67

Which live entities leave the outgoing scene.

#### Parameters

##### entity

[`Entity`](../classes/Entity.md)

##### scene

[`Scene`](../classes/Scene.md)

#### Returns

`boolean`

[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / CarriedSlot

# Interface: CarriedSlot

Defined in: engine/src/systems/SaveSystem.ts:122

Access to an in-flight carry snapshot (the entities between `loadScene({ carry })` and `restoreCarried()`).

## Methods

### get()

> **get**(): [`SceneSnapshot`](SceneSnapshot.md) \| `undefined`

Defined in: engine/src/systems/SaveSystem.ts:123

#### Returns

[`SceneSnapshot`](SceneSnapshot.md) \| `undefined`

***

### set()

> **set**(`snapshot`): `void`

Defined in: engine/src/systems/SaveSystem.ts:124

#### Parameters

##### snapshot

[`SceneSnapshot`](SceneSnapshot.md)

#### Returns

`void`

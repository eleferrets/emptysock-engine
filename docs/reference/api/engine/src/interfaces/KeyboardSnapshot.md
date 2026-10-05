[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / KeyboardSnapshot

# Interface: KeyboardSnapshot

Defined in: engine/src/Input.ts:50

Read-only, per-frame-frozen keyboard state — the engine design notes's raw escape hatch.

## Methods

### isCharDown()

> **isCharDown**(`ch`): `boolean`

Defined in: engine/src/Input.ts:54

Layout-aware: is the key that types this letter on the active layout down. False when the layout has no such key.

#### Parameters

##### ch

`string`

#### Returns

`boolean`

***

### isDown()

> **isDown**(`code`): `boolean`

Defined in: engine/src/Input.ts:52

Physical: is the key with this `KeyboardEvent.code` down.

#### Parameters

##### code

`string`

#### Returns

`boolean`

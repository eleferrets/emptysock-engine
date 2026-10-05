[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / SceneDefinition

# Interface: SceneDefinition

Defined in: engine/src/Game.ts:40

Optional per-frame hooks a `SceneDefinition` may implement.

## Properties

### carryOnLeave?

> `optional` **carryOnLeave?**: `boolean`

Defined in: engine/src/Game.ts:66

When `true`, leaving this scene carries the entities `transfer.select`
picks into whatever scene loads next, without the caller passing
`loadScene(.., { carry })` (runtimes that swap rooms from game code).
An explicit `carry` option wins; `restart: "game"` carries nothing.

***

### onUpdate?

> `optional` **onUpdate?**: [`UpdateFn`](../type-aliases/UpdateFn.md)

Defined in: engine/src/Game.ts:46

Called every frame, after physics/actors/collision, before render.

***

### persistentKey?

> `optional` **persistentKey?**: `string`

Defined in: engine/src/Game.ts:52

Makes this a persistent room: when it is left, the state of its entities
is cached under this key and `SceneLifecycle.restoreRoom()` brings it back
on the next visit (room "Persistent" flag).

***

### transfer?

> `optional` **transfer?**: [`TransferPolicy`](TransferPolicy.md)

Defined in: engine/src/Game.ts:59

Transfer policy describing this scene's entities: `select` marks the ones
that travel with the game (object-persistent) and are therefore excluded
from the room cache; `extras` are the per-entity side tables cached and
restored with the room. Default: `persistentTransferPolicy`, no extras.

## Methods

### onLoad()?

> `optional` **onLoad**(`scene`, `ctx`): `void` \| `Promise`\<`void`\>

Defined in: engine/src/Game.ts:42

Called once, after the engine has created this scene's systems.

#### Parameters

##### scene

[`Scene`](../classes/Scene.md)

##### ctx

[`SceneLifecycle`](SceneLifecycle.md)

#### Returns

`void` \| `Promise`\<`void`\>

***

### onUnload()?

> `optional` **onUnload**(`scene`, `ctx`): `void` \| `Promise`\<`void`\>

Defined in: engine/src/Game.ts:44

Called once, before the engine tears this scene's systems down.

#### Parameters

##### scene

[`Scene`](../classes/Scene.md)

##### ctx

[`SceneLifecycle`](SceneLifecycle.md)

#### Returns

`void` \| `Promise`\<`void`\>

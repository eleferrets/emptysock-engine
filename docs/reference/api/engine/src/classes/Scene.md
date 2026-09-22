[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / Scene

# Class: Scene

Defined in: [engine/src/core/Scene.ts:9](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Scene.ts#L9)

## Constructors

### Constructor

> **new Scene**(`name`): `Scene`

Defined in: [engine/src/core/Scene.ts:24](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Scene.ts#L24)

#### Parameters

##### name

`string`

#### Returns

`Scene`

## Properties

### backgroundColor

> **backgroundColor**: `number` = `0x1a1a2e`

Defined in: [engine/src/core/Scene.ts:11](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Scene.ts#L11)

***

### name

> `readonly` **name**: `string`

Defined in: [engine/src/core/Scene.ts:10](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Scene.ts#L10)

***

### systems

> `readonly` **systems**: [`SystemManager`](SystemManager.md)

Defined in: [engine/src/core/Scene.ts:21](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Scene.ts#L21)

The scene's system registry. `addSystem()`/`removeSystem()` are sugar
over this — there is one system-collection concept in the engine
(`SystemManager`), and every scene owns one. Reach for `this.systems`
directly only if you need `SystemManager`'s `get()` lookup.

***

### ui

> `readonly` **ui**: [`UISystem`](UISystem.md)

Defined in: [engine/src/core/Scene.ts:13](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Scene.ts#L13)

Per-scene UI system. Add widgets here; cleared automatically on destroy.

## Accessors

### engine

#### Get Signature

> **get** **engine**(): `object`

Defined in: [engine/src/core/Scene.ts:29](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Scene.ts#L29)

Access engine-level operations (scene stack, error logging, debug API).

##### Returns

###### popScene

> **popScene**: () => `void`

Pop the top scene off the stack and resume the scene underneath.

Pop the current scene off the stack and resume the scene underneath.
Calls onDestroy() on the popped scene and clears its UI.
No-op if the stack is empty.

###### Returns

`void`

###### pushScene

> **pushScene**: (`scene`) => `void`

Push a new scene on top of the active scene (e.g. a pause menu over the game).
The scene underneath is paused but stays in memory. Call popScene() to return.

Push a new scene on top of the current one. The current scene is paused
but stays in memory. Its onDestroy is NOT called — use popScene() to resume.
onLoad() on the incoming scene runs before the first update tick.

###### Parameters

###### scene

`Scene`

###### Returns

`void`

###### debugBreak()

> **debugBreak**(`label`, `vars?`): `void`

Trigger a labelled breakpoint from game code. If `label` is in the active
breakpoint set, pauses the game loop and posts a debug:break message to
the host frame via the registered HostAdapter.

Example:
  Engine.debugBreak('player-hit', { hp: player.hp, x: player.x });

The IDE must have registered this label via addBreakpoint() in the
Debugger panel for the call to have any effect.

###### Parameters

###### label

`string`

###### vars?

`Record`\<`string`, `unknown`\> = `{}`

###### Returns

`void`

###### init()

> **init**(`adapter`): `void`

Attach a HostAdapter so the debugger message listener and postMessage
calls route through the correct host environment. Call once at startup
from the IDE layer or PlayRunner; game code should not call this.

###### Parameters

###### adapter

[`HostAdapter`](../interfaces/HostAdapter.md)

###### Returns

`void`

###### isDebugPaused()

> **isDebugPaused**(): `boolean`

Returns true when the IDE debugger has paused the game loop.
Scene.update() checks this each frame to skip updates while paused.

###### Returns

`boolean`

###### logDebugError()

> **logDebugError**(`msg`): `void`

Log a debug-level message without triggering error handlers.

###### Parameters

###### msg

`string`

###### Returns

`void`

###### logError()

> **logError**(`msg`): `void`

Log a runtime error to registered handlers and the console.

###### Parameters

###### msg

`string`

###### Returns

`void`

###### logErrorToFile()

> **logErrorToFile**(`msg`): `void`

Delegate to the file-log handler registered by the host layer. No-op if not set.

###### Parameters

###### msg

`string`

###### Returns

`void`

###### onError()

> **onError**(`handler`): () => `void`

Register a callback invoked whenever Engine.logError is called. Returns an unsubscribe function.

###### Parameters

###### handler

`ErrorHandler`

###### Returns

() => `void`

###### onFileLog()

> **onFileLog**(`handler`): () => `void`

Register a callback that receives the message when logErrorToFile is called.
Wire this up in the IDE/Tauri layer; game code and the engine core must not
import Tauri APIs directly. Returns an unsubscribe function.

###### Parameters

###### handler

`ErrorHandler`

###### Returns

() => `void`

###### setBreakpoints()

> **setBreakpoints**(`labels`): `void`

Programmatically set the active breakpoint labels. Prefer letting the IDE
keep this list in sync via debug:setBreakpoints postMessage, but this
method is available for use in tests or headless contexts.

###### Parameters

###### labels

`string`[]

###### Returns

`void`

***

### isRunning

#### Get Signature

> **get** **isRunning**(): `boolean`

Defined in: [engine/src/core/Scene.ts:157](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Scene.ts#L157)

##### Returns

`boolean`

## Methods

### addEntity()

> **addEntity**(`entity`): [`Entity`](Entity.md)

Defined in: [engine/src/core/Scene.ts:85](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Scene.ts#L85)

#### Parameters

##### entity

[`Entity`](Entity.md)

#### Returns

[`Entity`](Entity.md)

***

### addSystem()

> **addSystem**(`name`, `fn`): `void`

Defined in: [engine/src/core/Scene.ts:137](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Scene.ts#L137)

#### Parameters

##### name

`string`

##### fn

[`SystemFn`](../type-aliases/SystemFn.md)

#### Returns

`void`

***

### createEntity()

> **createEntity**(`name?`): [`Entity`](Entity.md)

Defined in: [engine/src/core/Scene.ts:79](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Scene.ts#L79)

#### Parameters

##### name?

`string`

#### Returns

[`Entity`](Entity.md)

***

### getEntities()

> **getEntities**(): `ReadonlyMap`\<`number`, [`Entity`](Entity.md)\>

Defined in: [engine/src/core/Scene.ts:131](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Scene.ts#L131)

#### Returns

`ReadonlyMap`\<`number`, [`Entity`](Entity.md)\>

***

### getEntitiesByTag()

> **getEntitiesByTag**(`tag`): [`Entity`](Entity.md)[]

Defined in: [engine/src/core/Scene.ts:116](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Scene.ts#L116)

#### Parameters

##### tag

`string`

#### Returns

[`Entity`](Entity.md)[]

***

### getEntitiesWithComponent()

> **getEntitiesWithComponent**(`type`): [`Entity`](Entity.md)[]

Defined in: [engine/src/core/Scene.ts:125](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Scene.ts#L125)

Return all entities that have the given component type string attached.
The type string must match the `Component.type` field exactly — it is not
derived from a constructor name (which is unsafe under minification).

#### Parameters

##### type

`string` \| [`ComponentType`](../type-aliases/ComponentType.md)

#### Returns

[`Entity`](Entity.md)[]

***

### getEntity()

> **getEntity**(`id`): [`Entity`](Entity.md) \| `undefined`

Defined in: [engine/src/core/Scene.ts:104](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Scene.ts#L104)

#### Parameters

##### id

`number`

#### Returns

[`Entity`](Entity.md) \| `undefined`

***

### getEntityByName()

> **getEntityByName**(`name`): [`Entity`](Entity.md) \| `undefined`

Defined in: [engine/src/core/Scene.ts:109](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Scene.ts#L109)

Find an entity by name. Returns the first match, or undefined.

#### Parameters

##### name

`string`

#### Returns

[`Entity`](Entity.md) \| `undefined`

***

### onDestroy()

> **onDestroy**(): `void`

Defined in: [engine/src/core/Scene.ts:63](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Scene.ts#L63)

Called when the scene is removed from the stack or replaced. Cancel timers,
audio, and external subscriptions here.

#### Returns

`void`

***

### onFixedUpdate()

> **onFixedUpdate**(`_dt`): `void`

Defined in: [engine/src/core/Scene.ts:57](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Scene.ts#L57)

Called every physics tick (fixed 1/60 s by default) while the scene is
running. Use for velocity, force, and physics state reads.

#### Parameters

##### \_dt

`number`

#### Returns

`void`

***

### onLoad()

> **onLoad**(): `Promise`\<`void`\>

Defined in: [engine/src/core/Scene.ts:39](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Scene.ts#L39)

Called once before the scene begins updating. May be async — awaited by
SceneManager before the first update() tick.

#### Returns

`Promise`\<`void`\>

***

### onPause()

> **onPause**(): `void`

Defined in: [engine/src/core/Scene.ts:69](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Scene.ts#L69)

Called when another scene is pushed on top of this one (scene is now
paused beneath an overlay). Stop movement / AI here.

#### Returns

`void`

***

### onResume()

> **onResume**(): `void`

Defined in: [engine/src/core/Scene.ts:75](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Scene.ts#L75)

Called when the overlay above this scene is popped and this scene
becomes active again.

#### Returns

`void`

***

### onStart()

> **onStart**(): `void`

Defined in: [engine/src/core/Scene.ts:45](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Scene.ts#L45)

Called once after `onLoad` resolves, just before the first frame.
Use for work that must run after all assets are ready but is synchronous.

#### Returns

`void`

***

### onUpdate()

> **onUpdate**(`_dt`): `void`

Defined in: [engine/src/core/Scene.ts:51](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Scene.ts#L51)

Called every frame while the scene is running. Must be synchronous.
Use coroutines for multi-frame work.

#### Parameters

##### \_dt

`number`

#### Returns

`void`

***

### removeEntity()

> **removeEntity**(`entity`): `boolean`

Defined in: [engine/src/core/Scene.ts:100](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Scene.ts#L100)

#### Parameters

##### entity

[`Entity`](Entity.md)

#### Returns

`boolean`

***

### removeSystem()

> **removeSystem**(`name`): `boolean`

Defined in: [engine/src/core/Scene.ts:141](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Scene.ts#L141)

#### Parameters

##### name

`string`

#### Returns

`boolean`

***

### update()

> **update**(`deltaTime`): `void`

Defined in: [engine/src/core/Scene.ts:176](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Scene.ts#L176)

#### Parameters

##### deltaTime

`number`

#### Returns

`void`

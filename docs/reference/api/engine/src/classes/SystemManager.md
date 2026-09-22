[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / SystemManager

# Class: SystemManager

Defined in: [engine/src/core/SystemManager.ts:17](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/SystemManager.ts#L17)

The engine's single system registry: a named collection of systems,
updated in registration order. `Scene.addSystem()` is a thin, scene-scoped
convenience wrapper over one of these — every `Scene` owns its own
`SystemManager` internally, so there is exactly one "collection of
systems" concept in the engine, not two.

Construct a `SystemManager` directly only when you need a system
collection that outlives any single scene (a process-level manager, or a
custom runner that doesn't use `Scene` at all).

## Constructors

### Constructor

> **new SystemManager**(): `SystemManager`

#### Returns

`SystemManager`

## Methods

### destroy()

> **destroy**(): `void`

Defined in: [engine/src/core/SystemManager.ts:44](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/SystemManager.ts#L44)

Destroys every registered system and clears the registry.

#### Returns

`void`

***

### get()

> **get**\<`T`\>(`name`): `T` \| `undefined`

Defined in: [engine/src/core/SystemManager.ts:39](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/SystemManager.ts#L39)

#### Type Parameters

##### T

`T` *extends* [`UpdatableSystem`](../interfaces/UpdatableSystem.md)

#### Parameters

##### name

`string`

#### Returns

`T` \| `undefined`

***

### register()

> **register**(`name`, `system`): `void`

Defined in: [engine/src/core/SystemManager.ts:20](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/SystemManager.ts#L20)

#### Parameters

##### name

`string`

##### system

[`UpdatableSystem`](../interfaces/UpdatableSystem.md)

#### Returns

`void`

***

### unregister()

> **unregister**(`name`): `boolean`

Defined in: [engine/src/core/SystemManager.ts:25](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/SystemManager.ts#L25)

Unregisters and destroys the system. Returns false if no system was registered under `name`.

#### Parameters

##### name

`string`

#### Returns

`boolean`

***

### updateAll()

> **updateAll**(`dt`): `void`

Defined in: [engine/src/core/SystemManager.ts:33](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/SystemManager.ts#L33)

#### Parameters

##### dt

`number`

#### Returns

`void`

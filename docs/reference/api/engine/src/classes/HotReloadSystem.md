[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / HotReloadSystem

# Class: HotReloadSystem

Defined in: [engine/src/systems/HotReloadSystem.ts:10](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/HotReloadSystem.ts#L10)

HotReloadSystem — registers per-reload hooks that the IDE layer calls during
hot reload. Game code calls the on* registration methods (e.g. in onLoad) to
receive reload events.

The IDE / host layer is responsible for wiring window.__es_before_reload__ and
the other window-level globals to this system's runBefore/runAfter/etc helpers.
The engine does not write to window directly.

## Constructors

### Constructor

> **new HotReloadSystem**(): `HotReloadSystem`

#### Returns

`HotReloadSystem`

## Methods

### destroy()

> **destroy**(): `void`

Defined in: [engine/src/systems/HotReloadSystem.ts:68](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/HotReloadSystem.ts#L68)

Clear all registered hooks (call when the scene is destroyed).

#### Returns

`void`

***

### onAfterReload()

> **onAfterReload**(`fn`): () => `void`

Defined in: [engine/src/systems/HotReloadSystem.ts:24](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/HotReloadSystem.ts#L24)

#### Parameters

##### fn

() => `void`

#### Returns

() => `void`

***

### onBeforeReload()

> **onBeforeReload**(`fn`): () => `void`

Defined in: [engine/src/systems/HotReloadSystem.ts:19](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/HotReloadSystem.ts#L19)

#### Parameters

##### fn

() => `void`

#### Returns

() => `void`

***

### onRoomReload()

> **onRoomReload**(`fn`): () => `void`

Defined in: [engine/src/systems/HotReloadSystem.ts:39](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/HotReloadSystem.ts#L39)

#### Parameters

##### fn

(`name`, `roomJson`) => `void`

#### Returns

() => `void`

***

### onShaderReload()

> **onShaderReload**(`fn`): () => `void`

Defined in: [engine/src/systems/HotReloadSystem.ts:34](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/HotReloadSystem.ts#L34)

#### Parameters

##### fn

(`name`, `vert`, `frag`) => `void`

#### Returns

() => `void`

***

### onSpriteReload()

> **onSpriteReload**(`fn`): () => `void`

Defined in: [engine/src/systems/HotReloadSystem.ts:29](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/HotReloadSystem.ts#L29)

#### Parameters

##### fn

(`name`, `dataUrl`) => `void`

#### Returns

() => `void`

***

### runAfterReload()

> **runAfterReload**(): `void`

Defined in: [engine/src/systems/HotReloadSystem.ts:51](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/HotReloadSystem.ts#L51)

#### Returns

`void`

***

### runBeforeReload()

> **runBeforeReload**(): `void`

Defined in: [engine/src/systems/HotReloadSystem.ts:47](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/HotReloadSystem.ts#L47)

#### Returns

`void`

***

### runRoomReload()

> **runRoomReload**(`name`, `roomJson`): `void`

Defined in: [engine/src/systems/HotReloadSystem.ts:63](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/HotReloadSystem.ts#L63)

#### Parameters

##### name

`string`

##### roomJson

`string`

#### Returns

`void`

***

### runShaderReload()

> **runShaderReload**(`name`, `vert`, `frag`): `void`

Defined in: [engine/src/systems/HotReloadSystem.ts:59](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/HotReloadSystem.ts#L59)

#### Parameters

##### name

`string`

##### vert

`string`

##### frag

`string`

#### Returns

`void`

***

### runSpriteReload()

> **runSpriteReload**(`name`, `dataUrl`): `void`

Defined in: [engine/src/systems/HotReloadSystem.ts:55](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/HotReloadSystem.ts#L55)

#### Parameters

##### name

`string`

##### dataUrl

`string`

#### Returns

`void`

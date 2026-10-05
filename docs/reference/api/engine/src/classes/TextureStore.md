[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / TextureStore

# Class: TextureStore

Defined in: engine/src/systems/TextureStore.ts:16

The one texture load/lookup path shared by `RenderPipeline` (sprite sync,
`draw_sprite`) and `UISystem` (`ImageWidget`). With no custom loader it
delegates entirely to pixi's `Assets` cache: `Assets.load` (which itself
dedupes concurrent loads of one path) for loading, and a synchronous
`Assets.cache.has`/`Assets.get` for "already loaded?" lookups, so no
parallel `Map` of textures exists to drift from pixi's own. A custom
`TextureLoader` (the test/host seam) keeps a small local cache plus an
in-flight map so the same path is still only loaded once.

## Constructors

### Constructor

> **new TextureStore**(`loader?`): `TextureStore`

Defined in: engine/src/systems/TextureStore.ts:21

#### Parameters

##### loader?

[`TextureLoader`](../type-aliases/TextureLoader.md)

#### Returns

`TextureStore`

## Methods

### clear()

> **clear**(): `void`

Defined in: engine/src/systems/TextureStore.ts:57

Drops the local cache (custom-loader mode). pixi's global `Assets` cache is not touched.

#### Returns

`void`

***

### get()

> **get**(`path`): `Texture`\<`TextureSource`\<`any`\>\> \| `undefined`

Defined in: engine/src/systems/TextureStore.ts:26

The already-loaded texture for `path`, or `undefined` if not loaded yet. Never starts a load.

#### Parameters

##### path

`string`

#### Returns

`Texture`\<`TextureSource`\<`any`\>\> \| `undefined`

***

### load()

> **load**(`path`): `Promise`\<`Texture`\<`TextureSource`\<`any`\>\>\>

Defined in: engine/src/systems/TextureStore.ts:34

Loads `path` (or resolves from cache); concurrent calls for one path share one load.

#### Parameters

##### path

`string`

#### Returns

`Promise`\<`Texture`\<`TextureSource`\<`any`\>\>\>

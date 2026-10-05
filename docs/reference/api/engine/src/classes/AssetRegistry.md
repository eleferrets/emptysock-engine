[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / AssetRegistry

# Class: AssetRegistry

Defined in: engine/src/systems/AssetRegistry.ts:21

`Game`-scoped lookup of build-time asset facts (sprite size, font size,
which objects/rooms/... exist), loaded from the `asset-index.json` the asset
asset pipeline emits. Named `AssetRegistry`/`AssetIndex*` because `AssetManifest`
is the (unrelated) loader. Holds lookup facts only: `FontRegistry` still
owns rendering data. Storage is keyed `(kind, name)` so cross-kind name
collisions never overwrite each other; `resolve()` reports them.

With nothing loaded (`isEmpty`), compat getters degrade to their documented
"no registry" answers instead of throwing.

## Constructors

### Constructor

> **new AssetRegistry**(): `AssetRegistry`

#### Returns

`AssetRegistry`

## Accessors

### isEmpty

#### Get Signature

> **get** **isEmpty**(): `boolean`

Defined in: engine/src/systems/AssetRegistry.ts:46

True when nothing has been loaded/registered.

##### Returns

`boolean`

## Methods

### clear()

> **clear**(): `void`

Defined in: engine/src/systems/AssetRegistry.ts:41

#### Returns

`void`

***

### exists()

> **exists**(`kind`, `ref`): `boolean`

Defined in: engine/src/systems/AssetRegistry.ts:67

#### Parameters

##### kind

`"object"` \| `"script"` \| `"path"` \| `"font"` \| `"shader"` \| `"sprite"` \| `"sound"` \| `"room"` \| `"tileset"` \| `"timeline"` \| `"sequence"` \| `"note"`

##### ref

`unknown`

#### Returns

`boolean`

***

### frameCount()

> **frameCount**(`ref`): `number` \| `undefined`

Defined in: engine/src/systems/AssetRegistry.ts:87

#### Parameters

##### ref

`unknown`

#### Returns

`number` \| `undefined`

***

### get()

> **get**(`kind`, `ref`): \{ `bold?`: `boolean`; `frameCount?`: `number`; `height?`: `number`; `id`: `string`; `italic?`: `boolean`; `kind`: `"object"` \| `"script"` \| `"path"` \| `"font"` \| `"shader"` \| `"sprite"` \| `"sound"` \| `"room"` \| `"tileset"` \| `"timeline"` \| `"sequence"` \| `"note"`; `name`: `string`; `originX?`: `number`; `originY?`: `number`; `path?`: `string`; `size?`: `number`; `width?`: `number`; \} \| `undefined`

Defined in: engine/src/systems/AssetRegistry.ts:61

#### Parameters

##### kind

`"object"` \| `"script"` \| `"path"` \| `"font"` \| `"shader"` \| `"sprite"` \| `"sound"` \| `"room"` \| `"tileset"` \| `"timeline"` \| `"sequence"` \| `"note"`

##### ref

`unknown`

#### Returns

\{ `bold?`: `boolean`; `frameCount?`: `number`; `height?`: `number`; `id`: `string`; `italic?`: `boolean`; `kind`: `"object"` \| `"script"` \| `"path"` \| `"font"` \| `"shader"` \| `"sprite"` \| `"sound"` \| `"room"` \| `"tileset"` \| `"timeline"` \| `"sequence"` \| `"note"`; `name`: `string`; `originX?`: `number`; `originY?`: `number`; `path?`: `string`; `size?`: `number`; `width?`: `number`; \} \| `undefined`

***

### load()

> **load**(`index`): `void`

Defined in: engine/src/systems/AssetRegistry.ts:25

Replaces the whole registry. Throws a zod error on a malformed index.

#### Parameters

##### index

`unknown`

#### Returns

`void`

***

### names()

> **names**(`kind`): `string`[]

Defined in: engine/src/systems/AssetRegistry.ts:91

#### Parameters

##### kind

`"object"` \| `"script"` \| `"path"` \| `"font"` \| `"shader"` \| `"sprite"` \| `"sound"` \| `"room"` \| `"tileset"` \| `"timeline"` \| `"sequence"` \| `"note"`

#### Returns

`string`[]

***

### register()

> **register**(`entry`): `void`

Defined in: engine/src/systems/AssetRegistry.ts:32

Adds or overwrites one entry (within its kind). Manual/test use.

#### Parameters

##### entry

###### bold?

`boolean`

###### frameCount?

`number`

###### height?

`number`

###### id

`string`

###### italic?

`boolean`

###### kind

`"object"` \| `"script"` \| `"path"` \| `"font"` \| `"shader"` \| `"sprite"` \| `"sound"` \| `"room"` \| `"tileset"` \| `"timeline"` \| `"sequence"` \| `"note"`

###### name

`string`

###### originX?

`number`

###### originY?

`number`

###### path?

`string`

###### size?

`number`

###### width?

`number`

#### Returns

`void`

***

### resolve()

> **resolve**(`ref`): `object`[]

Defined in: engine/src/systems/AssetRegistry.ts:72

Every kind that has an asset matching `ref`; length > 1 is a collision.

#### Parameters

##### ref

`unknown`

#### Returns

`object`[]

***

### spriteSize()

> **spriteSize**(`ref`): \{ `height`: `number`; `width`: `number`; \} \| `undefined`

Defined in: engine/src/systems/AssetRegistry.ts:81

#### Parameters

##### ref

`unknown`

#### Returns

\{ `height`: `number`; `width`: `number`; \} \| `undefined`

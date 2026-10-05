[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / FontRegistry

# Class: FontRegistry

Defined in: engine/src/systems/FontRegistry.ts:30

## Constructors

### Constructor

> **new FontRegistry**(): `FontRegistry`

#### Returns

`FontRegistry`

## Methods

### clear()

> **clear**(): `void`

Defined in: engine/src/systems/FontRegistry.ts:78

Clears every registered font — mainly for test isolation between `Game` instances.

#### Returns

`void`

***

### cssFontFor()

> **cssFontFor**(`id`): `string` \| `undefined`

Defined in: engine/src/systems/FontRegistry.ts:66

Precomposed `"[italic ][bold ]<size>px <family>"` CSS font string, or `undefined` for an unregistered id.

#### Parameters

##### id

`string`

#### Returns

`string` \| `undefined`

***

### get()

> **get**(`id`): [`FontDescriptor`](../interfaces/FontDescriptor.md) \| `undefined`

Defined in: engine/src/systems/FontRegistry.ts:57

#### Parameters

##### id

`string`

#### Returns

[`FontDescriptor`](../interfaces/FontDescriptor.md) \| `undefined`

***

### getBitmap()

> **getBitmap**(`id`): [`BitmapFontDef`](../interfaces/BitmapFontDef.md) \| `undefined`

Defined in: engine/src/systems/FontRegistry.ts:45

#### Parameters

##### id

`string`

#### Returns

[`BitmapFontDef`](../interfaces/BitmapFontDef.md) \| `undefined`

***

### has()

> **has**(`id`): `boolean`

Defined in: engine/src/systems/FontRegistry.ts:61

#### Parameters

##### id

`string`

#### Returns

`boolean`

***

### hasBitmap()

> **hasBitmap**(`id`): `boolean`

Defined in: engine/src/systems/FontRegistry.ts:49

#### Parameters

##### id

`string`

#### Returns

`boolean`

***

### keys()

> **keys**(): `IterableIterator`\<`string`\>

Defined in: engine/src/systems/FontRegistry.ts:73

Every registered font id, for debugging/inspection tooling.

#### Returns

`IterableIterator`\<`string`\>

***

### register()

> **register**(`id`, `font`): `void`

Defined in: engine/src/systems/FontRegistry.ts:53

#### Parameters

##### id

`string`

##### font

[`FontDescriptor`](../interfaces/FontDescriptor.md)

#### Returns

`void`

***

### registerBitmap()

> **registerBitmap**(`id`, `def`): `void`

Defined in: engine/src/systems/FontRegistry.ts:41

Registers a pre-rendered bitmap font (atlas + glyph rects, see
`BitmapFontDef`) under `id`. Independent of `register()`: an id may have
a CSS descriptor, a bitmap def, or both — `PixiDrawTarget` prefers the
bitmap def for `draw_text` when one exists, and `UISystem`'s Canvas text
keeps using the descriptor.

#### Parameters

##### id

`string`

##### def

[`BitmapFontDef`](../interfaces/BitmapFontDef.md)

#### Returns

`void`

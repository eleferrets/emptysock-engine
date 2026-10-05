[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / WindowSystem

# Class: WindowSystem

Defined in: engine/src/systems/WindowSystem.ts:104

## Constructors

### Constructor

> **new WindowSystem**(): `WindowSystem`

#### Returns

`WindowSystem`

## Accessors

### currentConfig

#### Get Signature

> **get** **currentConfig**(): `Readonly`\<[`WindowConfig`](../interfaces/WindowConfig.md)\>

Defined in: engine/src/systems/WindowSystem.ts:221

##### Returns

`Readonly`\<[`WindowConfig`](../interfaces/WindowConfig.md)\>

***

### currentMode

#### Get Signature

> **get** **currentMode**(): [`WindowMode`](../type-aliases/WindowMode.md)

Defined in: engine/src/systems/WindowSystem.ts:217

##### Returns

[`WindowMode`](../type-aliases/WindowMode.md)

## Methods

### apply()

> **apply**(`config`): `Promise`\<`void`\>

Defined in: engine/src/systems/WindowSystem.ts:112

Apply an initial config at game startup. Mirrors the project's window
settings so game code doesn't have to call individual setters on load.

#### Parameters

##### config

`Partial`\<[`WindowConfig`](../interfaces/WindowConfig.md)\>

#### Returns

`Promise`\<`void`\>

***

### center()

> **center**(): `Promise`\<`void`\>

Defined in: engine/src/systems/WindowSystem.ts:202

#### Returns

`Promise`\<`void`\>

***

### destroy()

> **destroy**(): `void`

Defined in: engine/src/systems/WindowSystem.ts:225

#### Returns

`void`

***

### getSize()

> **getSize**(): `object`

Defined in: engine/src/systems/WindowSystem.ts:140

The window's last-known width/height, in real OS pixels on desktop or
the backing element's CSS pixels in the browser — whatever `apply()`/
`setSize()` most recently set (or `DEFAULT_CONFIG`'s value if neither
has run yet). Not an async live query of the real OS window (unlike
`setSize`, which does await one) — the `window_get_width`/
`_height` are synchronous, so this reads back the same authored value
this class itself is the source of truth for, matching every other
compat function's "read the value this engine already tracks" shape.

#### Returns

`object`

##### height

> **height**: `number`

##### width

> **width**: `number`

***

### setAlwaysOnTop()

> **setAlwaysOnTop**(`value`): `Promise`\<`void`\>

Defined in: engine/src/systems/WindowSystem.ts:210

#### Parameters

##### value

`boolean`

#### Returns

`Promise`\<`void`\>

***

### setMinSize()

> **setMinSize**(`width`, `height`): `Promise`\<`void`\>

Defined in: engine/src/systems/WindowSystem.ts:185

#### Parameters

##### width

`number`

##### height

`number`

#### Returns

`Promise`\<`void`\>

***

### setMode()

> **setMode**(`mode`): `Promise`\<`void`\>

Defined in: engine/src/systems/WindowSystem.ts:144

#### Parameters

##### mode

[`WindowMode`](../type-aliases/WindowMode.md)

#### Returns

`Promise`\<`void`\>

***

### setPosition()

> **setPosition**(`x`, `y`): `Promise`\<`void`\>

Defined in: engine/src/systems/WindowSystem.ts:194

#### Parameters

##### x

`number`

##### y

`number`

#### Returns

`Promise`\<`void`\>

***

### setResizable()

> **setResizable**(`resizable`): `Promise`\<`void`\>

Defined in: engine/src/systems/WindowSystem.ts:176

#### Parameters

##### resizable

`boolean`

#### Returns

`Promise`\<`void`\>

***

### setSize()

> **setSize**(`width`, `height`): `Promise`\<`void`\>

Defined in: engine/src/systems/WindowSystem.ts:154

#### Parameters

##### width

`number`

##### height

`number`

#### Returns

`Promise`\<`void`\>

***

### setTitle()

> **setTitle**(`title`): `Promise`\<`void`\>

Defined in: engine/src/systems/WindowSystem.ts:165

#### Parameters

##### title

`string`

#### Returns

`Promise`\<`void`\>

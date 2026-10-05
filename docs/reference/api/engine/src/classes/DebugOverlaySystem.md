[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / DebugOverlaySystem

# Class: DebugOverlaySystem

Defined in: engine/src/systems/DebugOverlaySystem.ts:28

Disabled by default; a stats line + scrollback console, a command
registry, rendered through `WidgetTree`/`UISystem` (`PanelStyle` +
`Label` widgets), so it works identically in Node/tests, the browser
preview, and the Tauri WebView. Uses `Layout`'s `positionType: "absolute"`
(added for exactly this: a fixed HUD overlay position independent of any
sibling flex layout).

## Constructors

### Constructor

> **new DebugOverlaySystem**(`scene`, `tree`): `DebugOverlaySystem`

Defined in: engine/src/systems/DebugOverlaySystem.ts:43

#### Parameters

##### scene

[`Scene`](Scene.md)

##### tree

[`WidgetTree`](WidgetTree.md)

#### Returns

`DebugOverlaySystem`

## Properties

### root

> `readonly` **root**: [`Entity`](Entity.md)

Defined in: engine/src/systems/DebugOverlaySystem.ts:39

## Accessors

### commandNames

#### Get Signature

> **get** **commandNames**(): readonly `string`[]

Defined in: engine/src/systems/DebugOverlaySystem.ts:186

##### Returns

readonly `string`[]

***

### enabled

#### Get Signature

> **get** **enabled**(): `boolean`

Defined in: engine/src/systems/DebugOverlaySystem.ts:88

##### Returns

`boolean`

***

### history

#### Get Signature

> **get** **history**(): readonly [`DebugLogEntry`](../interfaces/DebugLogEntry.md)[]

Defined in: engine/src/systems/DebugOverlaySystem.ts:147

##### Returns

readonly [`DebugLogEntry`](../interfaces/DebugLogEntry.md)[]

## Methods

### disable()

> **disable**(): `void`

Defined in: engine/src/systems/DebugOverlaySystem.ts:98

#### Returns

`void`

***

### enable()

> **enable**(): `void`

Defined in: engine/src/systems/DebugOverlaySystem.ts:92

#### Returns

`void`

***

### log()

> **log**(`message`): `void`

Defined in: engine/src/systems/DebugOverlaySystem.ts:136

#### Parameters

##### message

`string`

#### Returns

`void`

***

### logError()

> **logError**(`message`): `void`

Defined in: engine/src/systems/DebugOverlaySystem.ts:143

Intended to be wired to Engine.logError so runtime errors surface in-overlay.

#### Parameters

##### message

`string`

#### Returns

`void`

***

### registerCommand()

> **registerCommand**(`name`, `handler`): `void`

Defined in: engine/src/systems/DebugOverlaySystem.ts:158

#### Parameters

##### name

`string`

##### handler

[`DebugCommandHandler`](../type-aliases/DebugCommandHandler.md)

#### Returns

`void`

***

### runCommand()

> **runCommand**(`line`): `string`

Defined in: engine/src/systems/DebugOverlaySystem.ts:167

Parses "name arg1 arg2" and dispatches to a registered command.

#### Parameters

##### line

`string`

#### Returns

`string`

***

### toggle()

> **toggle**(): `void`

Defined in: engine/src/systems/DebugOverlaySystem.ts:104

#### Returns

`void`

***

### unregisterCommand()

> **unregisterCommand**(`name`): `void`

Defined in: engine/src/systems/DebugOverlaySystem.ts:162

#### Parameters

##### name

`string`

#### Returns

`void`

***

### update()

> **update**(`dt`, `entityCount`): `void`

Defined in: engine/src/systems/DebugOverlaySystem.ts:110

Call once per frame with the frame's delta time (seconds) and current entity count.

#### Parameters

##### dt

`number`

##### entityCount

`number`

#### Returns

`void`

***

### warn()

> **warn**(`message`): `void`

Defined in: engine/src/systems/DebugOverlaySystem.ts:139

#### Parameters

##### message

`string`

#### Returns

`void`

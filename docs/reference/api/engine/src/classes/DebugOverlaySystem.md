[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / DebugOverlaySystem

# Class: DebugOverlaySystem

Defined in: [engine/src/systems/DebugOverlaySystem.ts:27](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/DebugOverlaySystem.ts#L27)

## Constructors

### Constructor

> **new DebugOverlaySystem**(): `DebugOverlaySystem`

Defined in: [engine/src/systems/DebugOverlaySystem.ts:42](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/DebugOverlaySystem.ts#L42)

#### Returns

`DebugOverlaySystem`

## Properties

### root

> `readonly` **root**: [`PanelWidget`](PanelWidget.md)

Defined in: [engine/src/systems/DebugOverlaySystem.ts:38](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/DebugOverlaySystem.ts#L38)

## Accessors

### commandNames

#### Get Signature

> **get** **commandNames**(): readonly `string`[]

Defined in: [engine/src/systems/DebugOverlaySystem.ts:173](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/DebugOverlaySystem.ts#L173)

##### Returns

readonly `string`[]

***

### enabled

#### Get Signature

> **get** **enabled**(): `boolean`

Defined in: [engine/src/systems/DebugOverlaySystem.ts:84](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/DebugOverlaySystem.ts#L84)

##### Returns

`boolean`

***

### history

#### Get Signature

> **get** **history**(): readonly [`DebugLogEntry`](../interfaces/DebugLogEntry.md)[]

Defined in: [engine/src/systems/DebugOverlaySystem.ts:134](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/DebugOverlaySystem.ts#L134)

##### Returns

readonly [`DebugLogEntry`](../interfaces/DebugLogEntry.md)[]

## Methods

### disable()

> **disable**(): `void`

Defined in: [engine/src/systems/DebugOverlaySystem.ts:93](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/DebugOverlaySystem.ts#L93)

#### Returns

`void`

***

### enable()

> **enable**(): `void`

Defined in: [engine/src/systems/DebugOverlaySystem.ts:88](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/DebugOverlaySystem.ts#L88)

#### Returns

`void`

***

### log()

> **log**(`message`): `void`

Defined in: [engine/src/systems/DebugOverlaySystem.ts:123](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/DebugOverlaySystem.ts#L123)

#### Parameters

##### message

`string`

#### Returns

`void`

***

### logError()

> **logError**(`message`): `void`

Defined in: [engine/src/systems/DebugOverlaySystem.ts:130](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/DebugOverlaySystem.ts#L130)

Intended to be wired to Engine.logError so runtime errors surface in-overlay.

#### Parameters

##### message

`string`

#### Returns

`void`

***

### registerCommand()

> **registerCommand**(`name`, `handler`): `void`

Defined in: [engine/src/systems/DebugOverlaySystem.ts:145](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/DebugOverlaySystem.ts#L145)

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

Defined in: [engine/src/systems/DebugOverlaySystem.ts:154](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/DebugOverlaySystem.ts#L154)

Parses "name arg1 arg2" and dispatches to a registered command.

#### Parameters

##### line

`string`

#### Returns

`string`

***

### toggle()

> **toggle**(): `void`

Defined in: [engine/src/systems/DebugOverlaySystem.ts:98](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/DebugOverlaySystem.ts#L98)

#### Returns

`void`

***

### unregisterCommand()

> **unregisterCommand**(`name`): `void`

Defined in: [engine/src/systems/DebugOverlaySystem.ts:149](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/DebugOverlaySystem.ts#L149)

#### Parameters

##### name

`string`

#### Returns

`void`

***

### update()

> **update**(`dt`, `entityCount`): `void`

Defined in: [engine/src/systems/DebugOverlaySystem.ts:103](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/DebugOverlaySystem.ts#L103)

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

Defined in: [engine/src/systems/DebugOverlaySystem.ts:126](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/DebugOverlaySystem.ts#L126)

#### Parameters

##### message

`string`

#### Returns

`void`

[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / Diagnostics

# Variable: Diagnostics

> `const` **Diagnostics**: `object`

Defined in: engine/src/Diagnostics.ts:42

## Type Declaration

### debugBreak()

> **debugBreak**(`label`, `vars?`): `void`

Trigger a labelled breakpoint from game code. If `label` is in the active
breakpoint set, pauses the game loop and posts a debug:break message to
the host frame via the registered HostAdapter.

Example:
  Diagnostics.debugBreak('player-hit', { hp: player.hp, x: player.x });

The IDE must have registered this label via addBreakpoint() in the
Debugger panel for the call to have any effect.

#### Parameters

##### label

`string`

##### vars?

`Record`\<`string`, `unknown`\> = `{}`

#### Returns

`void`

### init()

> **init**(`adapter`): `void`

Attach a HostAdapter so the debugger message listener and postMessage
calls route through the correct host environment. Call once at startup
from the IDE layer or PlayRunner; game code should not call this.

#### Parameters

##### adapter

`HostAdapter`

#### Returns

`void`

### isDebugPaused()

> **isDebugPaused**(): `boolean`

Returns true when the IDE debugger has paused the game loop.
`Game.update()` checks this each frame to skip updates while paused.

#### Returns

`boolean`

### logDebugError()

> **logDebugError**(`msg`): `void`

Log a debug-level message without triggering error handlers.

#### Parameters

##### msg

`string`

#### Returns

`void`

### logError()

> **logError**(`msg`): `void`

Log a runtime error to registered handlers and the console.

#### Parameters

##### msg

`string`

#### Returns

`void`

### logErrorToFile()

> **logErrorToFile**(`msg`): `void`

Delegate to the file-log handler registered by the host layer. No-op if not set.

#### Parameters

##### msg

`string`

#### Returns

`void`

### onError()

> **onError**(`handler`): () => `void`

Register a callback invoked whenever Diagnostics.logError is called. Returns an unsubscribe function.

#### Parameters

##### handler

`ErrorHandler`

#### Returns

() => `void`

### onFileLog()

> **onFileLog**(`handler`): () => `void`

Register a callback that receives the message when logErrorToFile is called.
Wire this up in the IDE/Tauri layer; game code and the engine core must not
import Tauri APIs directly. Returns an unsubscribe function.

#### Parameters

##### handler

`ErrorHandler`

#### Returns

() => `void`

### setBreakpoints()

> **setBreakpoints**(`labels`): `void`

Programmatically set the active breakpoint labels. Prefer letting the IDE
keep this list in sync via debug:setBreakpoints postMessage, but this
method is available for use in tests or headless contexts.

#### Parameters

##### labels

`string`[]

#### Returns

`void`

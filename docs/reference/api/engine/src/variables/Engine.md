[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / Engine

# Variable: Engine

> `const` **Engine**: `object`

Defined in: [engine/src/core/EngineAPI.ts:39](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/EngineAPI.ts#L39)

## Type Declaration

### popScene

> **popScene**: () => `void`

Pop the top scene off the stack and resume the scene underneath.

Pop the current scene off the stack and resume the scene underneath.
Calls onDestroy() on the popped scene and clears its UI.
No-op if the stack is empty.

#### Returns

`void`

### pushScene

> **pushScene**: (`scene`) => `void`

Push a new scene on top of the active scene (e.g. a pause menu over the game).
The scene underneath is paused but stays in memory. Call popScene() to return.

Push a new scene on top of the current one. The current scene is paused
but stays in memory. Its onDestroy is NOT called — use popScene() to resume.
onLoad() on the incoming scene runs before the first update tick.

#### Parameters

##### scene

[`Scene`](../classes/Scene.md)

#### Returns

`void`

### debugBreak()

> **debugBreak**(`label`, `vars?`): `void`

Trigger a labelled breakpoint from game code. If `label` is in the active
breakpoint set, pauses the game loop and posts a debug:break message to
the host frame via the registered HostAdapter.

Example:
  Engine.debugBreak('player-hit', { hp: player.hp, x: player.x });

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

[`HostAdapter`](../interfaces/HostAdapter.md)

#### Returns

`void`

### isDebugPaused()

> **isDebugPaused**(): `boolean`

Returns true when the IDE debugger has paused the game loop.
Scene.update() checks this each frame to skip updates while paused.

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

Register a callback invoked whenever Engine.logError is called. Returns an unsubscribe function.

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

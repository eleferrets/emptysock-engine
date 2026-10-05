[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / StorageAdapter

# Interface: StorageAdapter

Defined in: engine/src/systems/StorageAdapter.ts:28

`SaveSystem`'s storage boundary. the engine design notes asks for one
save/load API that auto-picks IndexedDB in the browser preview and
Tauri's fs plugin on desktop — but CLAUDE.md's "Engine environment
boundary" forbids the engine package from importing DOM or Tauri APIs
directly (the same compiled bundle runs in Node/Vitest, the browser
preview iframe, and the Tauri WebView; a DOM-only import fails silently
in Node instead of at compile time).

Resolution, following the same pattern as `Transport` (CLAUDE.md:
"Transport is an interface, not a class" — NetworkActor takes an
interface, the engine never ships a concrete WebSocket/WebRTC impl):
`StorageAdapter` is an interface the engine defines and depends on, never
implements against a real backend. The concrete IndexedDB adapter and the
concrete Tauri-fs adapter are built and runtime-selected (per the
existing "Tauri detection at runtime" decision — `'__TAURI_INTERNALS__'
in window` at the call site) by the host — `apps/ide`'s preview shell and
the Tauri desktop shell respectively — and injected into `SaveSystem` via
its constructor. This keeps zero IndexedDB/Tauri code, and zero bundle
weight from either, inside `@emptysock/engine` itself.

`SaveSystem` defaults to `MemoryStorageAdapter` when no adapter is
injected, which is what makes it usable under the headless testing
harness (and any other Node context) with no host-provided backend at
all — the same "sane default that works under Node/headless tests too"
`Transport`-style injection implies.

## Methods

### delete()

> **delete**(`key`): `Promise`\<`void`\>

Defined in: engine/src/systems/StorageAdapter.ts:31

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

***

### get()

> **get**(`key`): `Promise`\<`string` \| `null`\>

Defined in: engine/src/systems/StorageAdapter.ts:29

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`string` \| `null`\>

***

### listKeys()

> **listKeys**(`prefix`): `Promise`\<`string`[]\>

Defined in: engine/src/systems/StorageAdapter.ts:33

All keys currently stored under `prefix`.

#### Parameters

##### prefix

`string`

#### Returns

`Promise`\<`string`[]\>

***

### set()

> **set**(`key`, `value`): `Promise`\<`void`\>

Defined in: engine/src/systems/StorageAdapter.ts:30

#### Parameters

##### key

`string`

##### value

`string`

#### Returns

`Promise`\<`void`\>

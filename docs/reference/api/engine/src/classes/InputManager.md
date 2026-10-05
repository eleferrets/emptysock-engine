[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / InputManager

# Class: InputManager

Defined in: engine/src/Input.ts:244

the engine design notes step 1 / §15.3 — the action-mapping input layer.

`input.isDown("jump")` is the default and only thing most games touch;
`input.keyboard`/`input.gamepad(0)`/`input.pointers`/`input.gestures`/
`input.wheelEvents` stay available for games that need exact device-level
state. Both paths read off the same frozen snapshot, taken once per frame
by `Game.update()` calling `snapshot()` as step 1 — no `isDown`/
`keyboard`/`gamepad`/`pointers`/`gestures`/`wheelEvents` call changes
value mid-frame, no matter how many real input events the OS delivers
while that frame's `update()` is still running (see the "Input snapshot:
frozen by copy, not by timing" entry in CLAUDE.md).

Raw device polling (`InputSystem`'s DOM listeners, `GamepadSystem`'s
`navigator.getGamepads()`, `PointerSystem`'s Pointer Events) is
unaffected by and independent of this class's environment: in Node/
headless (no `attach()` call, no `navigator.getGamepads`), every snapshot
is simply "nothing is down", matching CLAUDE.md's engine-environment-
boundary rule.

## Constructors

### Constructor

> **new InputManager**(`actions?`, `input?`, `gamepadSystem?`, `pointerSystem?`): `InputManager`

Defined in: engine/src/Input.ts:268

#### Parameters

##### actions?

[`ActionMap`](../type-aliases/ActionMap.md) = `{}`

##### input?

`InputSystem` = `...`

##### gamepadSystem?

`GamepadSystem` = `...`

##### pointerSystem?

`PointerSystem` = `...`

#### Returns

`InputManager`

## Accessors

### actions

#### Get Signature

> **get** **actions**(): readonly `string`[]

Defined in: engine/src/Input.ts:344

##### Returns

readonly `string`[]

***

### gestures

#### Get Signature

> **get** **gestures**(): readonly [`Gesture`](../type-aliases/Gesture.md)[]

Defined in: engine/src/Input.ts:521

Tap/longpress/swipe/pinch gestures that occurred since the previous
`snapshot()` call (this frame's gestures) — see `FrozenInputState`'s
doc comment on why this is a per-frame list, not continuous state.

##### Returns

readonly [`Gesture`](../type-aliases/Gesture.md)[]

***

### keyboard

#### Get Signature

> **get** **keyboard**(): [`KeyboardSnapshot`](../interfaces/KeyboardSnapshot.md)

Defined in: engine/src/Input.ts:484

Raw keyboard escape hatch (§15.3) — reads the frozen snapshot, not live state.

##### Returns

[`KeyboardSnapshot`](../interfaces/KeyboardSnapshot.md)

***

### layout

#### Get Signature

> **get** **layout**(): [`KeyboardLayout`](KeyboardLayout.md)

Defined in: engine/src/Input.ts:479

The keyboard layout translation layer. Hosts call `layout.setProvider(...)` at bootstrap; the engine itself never touches `navigator`.

##### Returns

[`KeyboardLayout`](KeyboardLayout.md)

***

### pointers

#### Get Signature

> **get** **pointers**(): readonly [`PointerState`](../interfaces/PointerState.md)[]

Defined in: engine/src/Input.ts:512

Raw pointer escape hatch (§15.3) — unified mouse/touch/pen state, one
entry per currently-down pointer, reading the frozen snapshot, not
live state.

##### Returns

readonly [`PointerState`](../interfaces/PointerState.md)[]

***

### wheelEvents

#### Get Signature

> **get** **wheelEvents**(): readonly [`WheelEventInfo`](../interfaces/WheelEventInfo.md)[]

Defined in: engine/src/Input.ts:531

Raw wheel/trackpad events since the previous `snapshot()` call,
including `isPinchZoom`-flagged trackpad-pinch-via-`ctrlKey` events —
see `PointerSystem`'s `dispatchWheel` doc comment for the trackpad vs.
mouse-wheel classification heuristic.

##### Returns

readonly [`WheelEventInfo`](../interfaces/WheelEventInfo.md)[]

## Methods

### addBinding()

> **addBinding**(`action`, `binding`): `void`

Defined in: engine/src/Input.ts:321

Append one binding to an action (duplicates ignored).

#### Parameters

##### action

`string`

##### binding

[`Binding`](../type-aliases/Binding.md)

#### Returns

`void`

***

### attach()

> **attach**(`target?`): `void`

Defined in: engine/src/Input.ts:289

Start listening to real device events. Never called by `Game` itself —
only the game's own browser/Tauri bootstrap code should call this,
since it touches `window` by default and must never run in the
headless/Node path (CLAUDE.md's engine-environment-boundary rule).

#### Parameters

##### target?

`EventTarget`

#### Returns

`void`

***

### bindAction()

> **bindAction**(`action`, `bindings`): `void`

Defined in: engine/src/Input.ts:311

Add or replace the bindings for a single action, leaving others untouched.

#### Parameters

##### action

`string`

##### bindings

readonly [`Binding`](../type-aliases/Binding.md)[]

#### Returns

`void`

***

### bindingLabel()

> **bindingLabel**(`b`): `string`

Defined in: engine/src/Input.ts:733

Human label for a binding ("A", "Q", "Space", "Pad A", "Axis 1+"). Key labels follow the active layout.

#### Parameters

##### b

[`Binding`](../type-aliases/Binding.md)

#### Returns

`string`

***

### captureNext()

> **captureNext**(`opts?`): `Promise`\<[`CaptureResult`](../interfaces/CaptureResult.md) \| `null`\>

Defined in: engine/src/Input.ts:559

Wait for the next new input and resolve with a `Binding` for it, or
`null` on cancel (Escape by default), timeout or abort. Arms on the
next `snapshot()`; anything already held at that moment must be released
first. The captured press is swallowed (reads as up) until released so
it does not also trigger the game action. Only one capture is pending
at a time: starting a new one cancels the previous with `null`.

#### Parameters

##### opts?

[`CaptureOptions`](../interfaces/CaptureOptions.md) = `{}`

#### Returns

`Promise`\<[`CaptureResult`](../interfaces/CaptureResult.md) \| `null`\>

***

### detach()

> **detach**(): `void`

Defined in: engine/src/Input.ts:300

Stop listening to real device events. Safe to call even if never attached.

#### Returns

`void`

***

### gamepad()

> **gamepad**(`index`): [`GamepadSnapshot`](../interfaces/GamepadSnapshot.md)

Defined in: engine/src/Input.ts:497

Raw gamepad escape hatch (§15.3) — reads the frozen snapshot, not live state.

#### Parameters

##### index

`number`

#### Returns

[`GamepadSnapshot`](../interfaces/GamepadSnapshot.md)

***

### getBindings()

> **getBindings**(`action`): readonly [`Binding`](../type-aliases/Binding.md)[]

Defined in: engine/src/Input.ts:348

#### Parameters

##### action

`string`

#### Returns

readonly [`Binding`](../type-aliases/Binding.md)[]

***

### isDown()

> **isDown**(`action`): `boolean`

Defined in: engine/src/Input.ts:472

True if any binding for `action` is active in the current frozen snapshot.

#### Parameters

##### action

`string`

#### Returns

`boolean`

***

### loadBindings()

> **loadBindings**(`adapter`, `key?`): `Promise`\<`boolean`\>

Defined in: engine/src/Input.ts:388

Load a previously `saveBindings()`-persisted action map. Returns `true`
if a saved map was found and applied, `false` (leaving the current
bindings untouched) if nothing was stored under `key` or the stored
value couldn't be parsed as an `ActionMap`.

#### Parameters

##### adapter

[`StorageAdapter`](../interfaces/StorageAdapter.md)

##### key?

`string` = `INPUT_BINDINGS_STORAGE_KEY`

#### Returns

`Promise`\<`boolean`\>

***

### rebind()

> **rebind**(`action`, `bindings`): `void`

Defined in: engine/src/Input.ts:316

Alias of `bindAction` — replace an action's bindings outright (the settings-menu "rebind" case).

#### Parameters

##### action

`string`

##### bindings

readonly [`Binding`](../type-aliases/Binding.md)[]

#### Returns

`void`

***

### rebindByCapture()

> **rebindByCapture**(`action`, `opts?`): `Promise`\<[`CaptureResult`](../interfaces/CaptureResult.md) \| `null`\>

Defined in: engine/src/Input.ts:588

`captureNext`, then `rebind` (or `addBinding` with `add: true`) the action to the result. Resolves `null` if cancelled.

#### Parameters

##### action

`string`

##### opts?

[`CaptureOptions`](../interfaces/CaptureOptions.md) & `object` = `{}`

#### Returns

`Promise`\<[`CaptureResult`](../interfaces/CaptureResult.md) \| `null`\>

***

### resetToDefaults()

> **resetToDefaults**(): `void`

Defined in: engine/src/Input.ts:357

Restore every action's bindings to the `actions` map this `InputManager`
was constructed with, discarding any `bindAction`/`setActions` rebinds
made since — the "reset to defaults" button a settings menu needs.

#### Returns

`void`

***

### saveBindings()

> **saveBindings**(`adapter`, `key?`): `Promise`\<`void`\>

Defined in: engine/src/Input.ts:375

Persist the current action map through a `StorageAdapter` — the same
interface `SaveSystem` takes (CLAUDE.md's "SaveSystem storage backend
is an injected adapter" decision), not `SaveSystem` itself: an
`ActionMap` is a `Game`-level settings blob, not per-entity component
data, so `SaveSystem`'s `Scene`/`ComponentDef`-bound API is the wrong
shape for it. Pass the same adapter a game's `SaveSystem` uses (or any
other `StorageAdapter`) to keep control rebinds in the same storage
backend as save data, or a separate one for settings that should
survive a save being deleted.

#### Parameters

##### adapter

[`StorageAdapter`](../interfaces/StorageAdapter.md)

##### key?

`string` = `INPUT_BINDINGS_STORAGE_KEY`

#### Returns

`Promise`\<`void`\>

***

### setActions()

> **setActions**(`actions`): `void`

Defined in: engine/src/Input.ts:306

Replace the whole action map (rebind everything at once).

#### Parameters

##### actions

[`ActionMap`](../type-aliases/ActionMap.md)

#### Returns

`void`

***

### simulateKeyDown()

> **simulateKeyDown**(`code`, `key?`): `void`

Defined in: engine/src/Input.ts:542

Test-only, non-DOM key injection (see `InputSystem.simulateKeyDown`).
Affects the *live* device state only — it has no effect on `isDown`/
`keyboard`/etc. until the next `snapshot()` call, which is the whole
point: it is how the freeze-for-the-frame behavior gets exercised by a
test without needing a real `KeyboardEvent`.

#### Parameters

##### code

`string`

##### key?

`string`

#### Returns

`void`

***

### simulateKeyUp()

> **simulateKeyUp**(`code`): `void`

Defined in: engine/src/Input.ts:547

See `simulateKeyDown`.

#### Parameters

##### code

`string`

#### Returns

`void`

***

### snapshot()

> **snapshot**(): `void`

Defined in: engine/src/Input.ts:422

the engine design notes step 1. Copies the current live device state into
this frame's frozen snapshot. `Game.update()` calls this exactly once,
before anything else runs. Calling it again mid-frame (nothing in the
engine does) would advance the snapshot early — tests that want to
prove the freeze holds call `simulateKeyDown`/`simulateKeyUp` and then
assert `isDown` is unaffected *until* the next `snapshot()` call.

#### Returns

`void`

***

### unbind()

> **unbind**(`action`, `binding?`): `void`

Defined in: engine/src/Input.ts:328

Remove one binding from an action, or the whole action when `binding` is omitted.

#### Parameters

##### action

`string`

##### binding?

[`Binding`](../type-aliases/Binding.md)

#### Returns

`void`

***

### wasPressed()

> **wasPressed**(`action`): `boolean`

Defined in: engine/src/Input.ts:462

True only on the frame (snapshot) the action went from inactive to active.

#### Parameters

##### action

`string`

#### Returns

`boolean`

***

### wasReleased()

> **wasReleased**(`action`): `boolean`

Defined in: engine/src/Input.ts:467

True only on the frame (snapshot) the action went from active to inactive.

#### Parameters

##### action

`string`

#### Returns

`boolean`

[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / InputBindings

# Class: InputBindings

Defined in: [engine/src/systems/InputBindings.ts:87](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/InputBindings.ts#L87)

## Constructors

### Constructor

> **new InputBindings**(`input`, `defaults`, `gamepad?`): `InputBindings`

Defined in: [engine/src/systems/InputBindings.ts:93](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/InputBindings.ts#L93)

#### Parameters

##### input

[`InputSystem`](InputSystem.md)

##### defaults

[`ActionMap`](../type-aliases/ActionMap.md)

##### gamepad?

[`GamepadSystem`](GamepadSystem.md) \| `null`

#### Returns

`InputBindings`

## Accessors

### actions

#### Get Signature

> **get** **actions**(): readonly `string`[]

Defined in: [engine/src/systems/InputBindings.ts:141](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/InputBindings.ts#L141)

##### Returns

readonly `string`[]

## Methods

### addBinding()

> **addBinding**(`action`, `binding`): `void`

Defined in: [engine/src/systems/InputBindings.ts:132](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/InputBindings.ts#L132)

Add a single binding to an action without clearing existing ones.

#### Parameters

##### action

`string`

##### binding

[`Binding`](../type-aliases/Binding.md)

#### Returns

`void`

***

### getBindings()

> **getBindings**(`action`): readonly [`Binding`](../type-aliases/Binding.md)[]

Defined in: [engine/src/systems/InputBindings.ts:137](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/InputBindings.ts#L137)

#### Parameters

##### action

`string`

#### Returns

readonly [`Binding`](../type-aliases/Binding.md)[]

***

### isActionActive()

> **isActionActive**(`action`): `boolean`

Defined in: [engine/src/systems/InputBindings.ts:105](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/InputBindings.ts#L105)

True if any binding for this action is currently active.

#### Parameters

##### action

`string`

#### Returns

`boolean`

***

### isActionPressed()

> **isActionPressed**(`action`): `boolean`

Defined in: [engine/src/systems/InputBindings.ts:115](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/InputBindings.ts#L115)

True the frame the action transitions from inactive to active.

#### Parameters

##### action

`string`

#### Returns

`boolean`

***

### load()

> **load**(`save`, `slotId?`): `boolean`

Defined in: [engine/src/systems/InputBindings.ts:162](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/InputBindings.ts#L162)

Load previously persisted bindings, if any. Returns true if applied.

#### Parameters

##### save

[`SaveSystem`](SaveSystem.md)\<[`BindingsSaveSlot`](../interfaces/BindingsSaveSlot.md)\>

##### slotId?

`string` = `SAVE_SLOT_ID`

#### Returns

`boolean`

***

### rebind()

> **rebind**(`action`, `bindings`): `void`

Defined in: [engine/src/systems/InputBindings.ts:127](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/InputBindings.ts#L127)

Replace all bindings for an action (rebind).

#### Parameters

##### action

`string`

##### bindings

[`Binding`](../type-aliases/Binding.md)[]

#### Returns

`void`

***

### resetToDefaults()

> **resetToDefaults**(): `void`

Defined in: [engine/src/systems/InputBindings.ts:145](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/InputBindings.ts#L145)

#### Returns

`void`

***

### save()

> **save**(`save`, `slotId?`): `void`

Defined in: [engine/src/systems/InputBindings.ts:154](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/InputBindings.ts#L154)

Persist the current bindings via SaveSystem's generic slot API. Pass a
`SaveSystem<BindingsSaveSlot>` (e.g. from `createBindingsSaveSystem()`),
not the default `GameSaveSlot`-shaped `SaveSystem`.

#### Parameters

##### save

[`SaveSystem`](SaveSystem.md)\<[`BindingsSaveSlot`](../interfaces/BindingsSaveSlot.md)\>

##### slotId?

`string` = `SAVE_SLOT_ID`

#### Returns

`void`

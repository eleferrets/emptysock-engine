[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / SignalGroup

# Class: SignalGroup

Defined in: engine/src/systems/SignalBus.ts:162

## Constructors

### Constructor

> **new SignalGroup**(`_bus`): `SignalGroup`

Defined in: engine/src/systems/SignalBus.ts:164

#### Parameters

##### \_bus

[`SignalBus`](SignalBus.md)

#### Returns

`SignalGroup`

## Methods

### dispose()

> **dispose**(): `void`

Defined in: engine/src/systems/SignalBus.ts:178

#### Returns

`void`

***

### emit()

> **emit**\<`T`\>(`name`, `payload?`): `number`

Defined in: engine/src/systems/SignalBus.ts:175

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### name

`string`

##### payload?

`T`

#### Returns

`number`

***

### on()

> **on**\<`T`\>(`name`, `fn`): [`Unsubscribe`](../type-aliases/Unsubscribe.md)

Defined in: engine/src/systems/SignalBus.ts:165

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### name

`string`

##### fn

[`SignalListener`](../type-aliases/SignalListener.md)\<`T`\>

#### Returns

[`Unsubscribe`](../type-aliases/Unsubscribe.md)

***

### once()

> **once**\<`T`\>(`name`, `fn`): [`Unsubscribe`](../type-aliases/Unsubscribe.md)

Defined in: engine/src/systems/SignalBus.ts:170

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### name

`string`

##### fn

[`SignalListener`](../type-aliases/SignalListener.md)\<`T`\>

#### Returns

[`Unsubscribe`](../type-aliases/Unsubscribe.md)

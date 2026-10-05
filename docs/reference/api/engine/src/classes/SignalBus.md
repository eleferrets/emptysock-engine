[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / SignalBus

# Class: SignalBus

Defined in: engine/src/systems/SignalBus.ts:30

## Constructors

### Constructor

> **new SignalBus**(): `SignalBus`

#### Returns

`SignalBus`

## Methods

### broadcast()

> **broadcast**\<`T`\>(`payload?`): `number`

Defined in: engine/src/systems/SignalBus.ts:90

Emits `payload` to every signal name that has at least one listener.

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### payload?

`T`

#### Returns

`number`

***

### clear()

> **clear**(): `void`

Defined in: engine/src/systems/SignalBus.ts:106

#### Returns

`void`

***

### emit()

> **emit**\<`T`\>(`name`, `payload?`): `number`

Defined in: engine/src/systems/SignalBus.ts:67

Calls every listener of `name` (then wildcards). Returns how many ran.

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

### group()

> **group**(): [`SignalGroup`](SignalGroup.md)

Defined in: engine/src/systems/SignalBus.ts:139

A scope whose subscriptions are all removed by one `dispose()`.

#### Returns

[`SignalGroup`](SignalGroup.md)

***

### listenerCount()

> **listenerCount**(`name?`): `number`

Defined in: engine/src/systems/SignalBus.ts:97

#### Parameters

##### name?

`string`

#### Returns

`number`

***

### off()

> **off**\<`T`\>(`name`, `fn`): `void`

Defined in: engine/src/systems/SignalBus.ts:53

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### name

`string`

##### fn

[`SignalListener`](../type-aliases/SignalListener.md)\<`T`\>

#### Returns

`void`

***

### on()

> **on**\<`T`\>(`name`, `fn`): [`Unsubscribe`](../type-aliases/Unsubscribe.md)

Defined in: engine/src/systems/SignalBus.ts:34

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

### onAny()

> **onAny**(`fn`): [`Unsubscribe`](../type-aliases/Unsubscribe.md)

Defined in: engine/src/systems/SignalBus.ts:61

Listens to every emitted signal.

#### Parameters

##### fn

[`SignalListener`](../type-aliases/SignalListener.md)

#### Returns

[`Unsubscribe`](../type-aliases/Unsubscribe.md)

***

### once()

> **once**\<`T`\>(`name`, `fn`): [`Unsubscribe`](../type-aliases/Unsubscribe.md)

Defined in: engine/src/systems/SignalBus.ts:45

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

### onEntity()

> **onEntity**\<`T`\>(`entity`, `name`, `fn`): [`Unsubscribe`](../type-aliases/Unsubscribe.md)

Defined in: engine/src/systems/SignalBus.ts:117

Subscribes `fn` to `name` for the lifetime of `entity`: when the entity
is destroyed (`Scene.destroy`, pooled or not) the listener is removed,
so a dead entity's handlers never leak or fire on a pooled reuse. Returns
an early unsubscribe. Throws on a destroyed entity.

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### entity

[`Entity`](Entity.md)

##### name

`string`

##### fn

[`SignalListener`](../type-aliases/SignalListener.md)\<`T`\>

#### Returns

[`Unsubscribe`](../type-aliases/Unsubscribe.md)

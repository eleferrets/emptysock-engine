[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / GlobalStore

# Class: GlobalStore

Defined in: engine/src/systems/GlobalStore.ts:80

## Constructors

### Constructor

> **new GlobalStore**(): `GlobalStore`

#### Returns

`GlobalStore`

## Methods

### clear()

> **clear**(): `void`

Defined in: engine/src/systems/GlobalStore.ts:202

Clears every stored global — mainly for test isolation between `Game` instances.

#### Returns

`void`

***

### declare()

> **declare**(`name`, `decl?`): `void`

Defined in: engine/src/systems/GlobalStore.ts:90

Declare `name` with an optional initial value and persistence flag. If
the name has no value yet and an `initial` is given, it is set to a copy
of it. Re-declaring replaces the declaration and never overwrites an
existing value. Undeclared names keep working through `set`.

#### Parameters

##### name

`string`

##### decl?

[`GlobalDeclaration`](../interfaces/GlobalDeclaration.md) = `{}`

#### Returns

`void`

***

### declared()

> **declared**(): `string`[]

Defined in: engine/src/systems/GlobalStore.ts:112

Names passed to `declare`, in declaration order.

#### Returns

`string`[]

***

### delete()

> **delete**(`name`): `boolean`

Defined in: engine/src/systems/GlobalStore.ts:192

#### Parameters

##### name

`string`

#### Returns

`boolean`

***

### get()

#### Call Signature

> **get**\<`K`\>(`name`): [`GameGlobals`](../interfaces/GameGlobals.md)\[`K`\] \| `undefined`

Defined in: engine/src/systems/GlobalStore.ts:176

##### Type Parameters

###### K

`K` *extends* `never`

##### Parameters

###### name

`K`

##### Returns

[`GameGlobals`](../interfaces/GameGlobals.md)\[`K`\] \| `undefined`

#### Call Signature

> **get**\<`T`\>(`name`): `T` \| `undefined`

Defined in: engine/src/systems/GlobalStore.ts:177

##### Type Parameters

###### T

`T` = `unknown`

##### Parameters

###### name

`string`

##### Returns

`T` \| `undefined`

***

### has()

> **has**(`name`): `boolean`

Defined in: engine/src/systems/GlobalStore.ts:188

#### Parameters

##### name

`string`

#### Returns

`boolean`

***

### keys()

> **keys**(): `IterableIterator`\<`string`\>

Defined in: engine/src/systems/GlobalStore.ts:197

Every currently-set global name, for debugging/inspection tooling.

#### Returns

`IterableIterator`\<`string`\>

***

### reset()

> **reset**(): `void`

Defined in: engine/src/systems/GlobalStore.ts:167

Drop every value (declared or not), then re-apply declared initials.
`game_restart` semantics: globals are whole-process state and a restart
forgets all of it. Declarations themselves are kept.

#### Returns

`void`

***

### restore()

> **restore**(`data`): `void`

Defined in: engine/src/systems/GlobalStore.ts:142

Apply a `snapshot()` result. Only declared `persist: true` names are
applied; anything else is ignored with a warning (a save from an older or
newer build must not inject arbitrary globals).

#### Parameters

##### data

`Readonly`\<`Record`\<`string`, `unknown`\>\>

#### Returns

`void`

***

### set()

#### Call Signature

> **set**\<`K`\>(`name`, `value`): `void`

Defined in: engine/src/systems/GlobalStore.ts:182

##### Type Parameters

###### K

`K` *extends* `never`

##### Parameters

###### name

`K`

###### value

[`GameGlobals`](../interfaces/GameGlobals.md)\[`K`\]

##### Returns

`void`

#### Call Signature

> **set**(`name`, `value`): `void`

Defined in: engine/src/systems/GlobalStore.ts:183

##### Parameters

###### name

`string`

###### value

`unknown`

##### Returns

`void`

***

### snapshot()

> **snapshot**(): `Record`\<`string`, [`Serializable`](../type-aliases/Serializable.md)\>

Defined in: engine/src/systems/GlobalStore.ts:121

JSON-clean copy of every declared `persist: true` name that currently has
a value. A value that is not JSON-clean (function, entity, map...) is
dropped with a warning rather than failing the whole snapshot.

#### Returns

`Record`\<`string`, [`Serializable`](../type-aliases/Serializable.md)\>

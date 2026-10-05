[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [vn/src](../README.md) / VNSystem

# Class: VNSystem

Defined in: vn/src/VNSystem.ts:66

## Constructors

### Constructor

> **new VNSystem**(`store?`): `VNSystem`

Defined in: vn/src/VNSystem.ts:95

#### Parameters

##### store?

`VariableStore` = `...`

The store backing `"condition"` nodes and conditional
`when` choice options. Defaults to a fresh, isolated `VariableStore` —
dialogue gated on switches/variables stays local to this `VNSystem`
instance unless you explicitly opt into sharing. Pass `ctx.variables`
(the same `Game`-owned instance every scene's `onLoad` receives via
`SceneLifecycle`, per `@emptysock/engine`'s `Game` service registry) to
make dialogue "just work" against the switches your game logic already
sets — that's an explicit choice at the call site now, not an implicit
process-global default.

#### Returns

`VNSystem`

## Properties

### variables

> `readonly` **variables**: `Map`\<`string`, `unknown`\>

Defined in: vn/src/VNSystem.ts:72

Runtime variable store — populated automatically by variable-set nodes.

## Accessors

### currentNode

#### Get Signature

> **get** **currentNode**(): [`DialogueNode`](../type-aliases/DialogueNode.md) \| `null`

Defined in: vn/src/VNSystem.ts:122

##### Returns

[`DialogueNode`](../type-aliases/DialogueNode.md) \| `null`

## Methods

### advance()

> **advance**(): `void`

Defined in: vn/src/VNSystem.ts:127

#### Returns

`void`

***

### getVariable()

> **getVariable**(`key`): `unknown`

Defined in: vn/src/VNSystem.ts:146

Read a runtime variable set by variable-set nodes. Returns undefined if not set.

#### Parameters

##### key

`string`

#### Returns

`unknown`

***

### load()

> **load**(`tree`): `void`

Defined in: vn/src/VNSystem.ts:107

#### Parameters

##### tree

[`DialogueTree`](../interfaces/DialogueTree.md)

#### Returns

`void`

***

### removeListener()

> **removeListener**(): `void`

Defined in: vn/src/VNSystem.ts:103

#### Returns

`void`

***

### selectOption()

> **selectOption**(`next`): `void`

Defined in: vn/src/VNSystem.ts:141

#### Parameters

##### next

`string`

#### Returns

`void`

***

### setListener()

> **setListener**(`listener`): `void`

Defined in: vn/src/VNSystem.ts:99

#### Parameters

##### listener

[`IVNListener`](../interfaces/IVNListener.md)

#### Returns

`void`

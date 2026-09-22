[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [vn/src](../README.md) / VNSystem

# Class: VNSystem

Defined in: [vn/src/VNSystem.ts:67](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/vn/src/VNSystem.ts#L67)

## Constructors

### Constructor

> **new VNSystem**(`store?`): `VNSystem`

Defined in: [vn/src/VNSystem.ts:83](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/vn/src/VNSystem.ts#L83)

#### Parameters

##### store?

`VariableStore` = `variableStore`

#### Returns

`VNSystem`

## Properties

### variables

> `readonly` **variables**: `Map`\<`string`, `unknown`\>

Defined in: [vn/src/VNSystem.ts:73](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/vn/src/VNSystem.ts#L73)

Runtime variable store — populated automatically by variable-set nodes.

## Accessors

### currentNode

#### Get Signature

> **get** **currentNode**(): [`DialogueNode`](../type-aliases/DialogueNode.md) \| `null`

Defined in: [vn/src/VNSystem.ts:110](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/vn/src/VNSystem.ts#L110)

##### Returns

[`DialogueNode`](../type-aliases/DialogueNode.md) \| `null`

## Methods

### advance()

> **advance**(): `void`

Defined in: [vn/src/VNSystem.ts:115](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/vn/src/VNSystem.ts#L115)

#### Returns

`void`

***

### getVariable()

> **getVariable**(`key`): `unknown`

Defined in: [vn/src/VNSystem.ts:134](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/vn/src/VNSystem.ts#L134)

Read a runtime variable set by variable-set nodes. Returns undefined if not set.

#### Parameters

##### key

`string`

#### Returns

`unknown`

***

### load()

> **load**(`tree`): `void`

Defined in: [vn/src/VNSystem.ts:95](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/vn/src/VNSystem.ts#L95)

#### Parameters

##### tree

[`DialogueTree`](../interfaces/DialogueTree.md)

#### Returns

`void`

***

### removeListener()

> **removeListener**(): `void`

Defined in: [vn/src/VNSystem.ts:91](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/vn/src/VNSystem.ts#L91)

#### Returns

`void`

***

### selectOption()

> **selectOption**(`next`): `void`

Defined in: [vn/src/VNSystem.ts:129](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/vn/src/VNSystem.ts#L129)

#### Parameters

##### next

`string`

#### Returns

`void`

***

### setListener()

> **setListener**(`listener`): `void`

Defined in: [vn/src/VNSystem.ts:87](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/vn/src/VNSystem.ts#L87)

#### Parameters

##### listener

[`IVNListener`](../interfaces/IVNListener.md)

#### Returns

`void`

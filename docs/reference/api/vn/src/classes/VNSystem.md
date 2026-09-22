[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [vn/src](../README.md) / VNSystem

# Class: VNSystem

Defined in: [vn/src/VNSystem.ts:67](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/vn/src/VNSystem.ts#L67)

## Constructors

### Constructor

> **new VNSystem**(`store?`): `VNSystem`

Defined in: [vn/src/VNSystem.ts:100](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/vn/src/VNSystem.ts#L100)

#### Parameters

##### store?

`VariableStore` = `variableStore`

The store backing `"condition"` nodes and conditional
`when` choice options. Defaults to `@emptysock/engine`'s shared,
process-global `variableStore` singleton — the SAME instance every
other caller in the game gets unless they too pass an explicit store.
That default is convenient (dialogue "just works" against the switches
your game logic already sets) but it is implicit, undocumented sharing:
a game using `@emptysock/vn` for dialogue AND reading/writing
`variableStore` directly elsewhere gets cross-talk for free — a VN
choice gated on switch 12 can be silently affected by an unrelated
`variableStore.setSwitch(12, ...)` call anywhere else in the game, and
vice versa. Pass an explicit `VariableStore` instance here (isolated
per-save-slot, or a plain test double) whenever that sharing is not
what you want. See CLAUDE.md's "Non-obvious decisions" for the
rationale (matches how `SaveSystem`'s `MemoryStorageAdapter` default is
documented there).

#### Returns

`VNSystem`

## Properties

### variables

> `readonly` **variables**: `Map`\<`string`, `unknown`\>

Defined in: [vn/src/VNSystem.ts:73](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/vn/src/VNSystem.ts#L73)

Runtime variable store — populated automatically by variable-set nodes.

## Accessors

### currentNode

#### Get Signature

> **get** **currentNode**(): [`DialogueNode`](../type-aliases/DialogueNode.md) \| `null`

Defined in: [vn/src/VNSystem.ts:127](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/vn/src/VNSystem.ts#L127)

##### Returns

[`DialogueNode`](../type-aliases/DialogueNode.md) \| `null`

## Methods

### advance()

> **advance**(): `void`

Defined in: [vn/src/VNSystem.ts:132](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/vn/src/VNSystem.ts#L132)

#### Returns

`void`

***

### getVariable()

> **getVariable**(`key`): `unknown`

Defined in: [vn/src/VNSystem.ts:151](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/vn/src/VNSystem.ts#L151)

Read a runtime variable set by variable-set nodes. Returns undefined if not set.

#### Parameters

##### key

`string`

#### Returns

`unknown`

***

### load()

> **load**(`tree`): `void`

Defined in: [vn/src/VNSystem.ts:112](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/vn/src/VNSystem.ts#L112)

#### Parameters

##### tree

[`DialogueTree`](../interfaces/DialogueTree.md)

#### Returns

`void`

***

### removeListener()

> **removeListener**(): `void`

Defined in: [vn/src/VNSystem.ts:108](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/vn/src/VNSystem.ts#L108)

#### Returns

`void`

***

### selectOption()

> **selectOption**(`next`): `void`

Defined in: [vn/src/VNSystem.ts:146](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/vn/src/VNSystem.ts#L146)

#### Parameters

##### next

`string`

#### Returns

`void`

***

### setListener()

> **setListener**(`listener`): `void`

Defined in: [vn/src/VNSystem.ts:104](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/vn/src/VNSystem.ts#L104)

#### Parameters

##### listener

[`IVNListener`](../interfaces/IVNListener.md)

#### Returns

`void`

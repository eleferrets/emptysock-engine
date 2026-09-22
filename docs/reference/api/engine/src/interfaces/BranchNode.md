[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / BranchNode

# Interface: BranchNode

Defined in: [engine/src/components/VisualScriptComponent.ts:44](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/VisualScriptComponent.ts#L44)

## Extends

- `VSNodeBase`

## Properties

### comparator

> **comparator**: `"eq"` \| `"neq"` \| `"gt"` \| `"lt"` \| `"gte"` \| `"lte"`

Defined in: [engine/src/components/VisualScriptComponent.ts:48](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/VisualScriptComponent.ts#L48)

***

### id

> **id**: `string`

Defined in: [engine/src/components/VisualScriptComponent.ts:25](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/VisualScriptComponent.ts#L25)

#### Inherited from

`VSNodeBase.id`

***

### kind

> **kind**: `"branch"`

Defined in: [engine/src/components/VisualScriptComponent.ts:45](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/VisualScriptComponent.ts#L45)

#### Overrides

`VSNodeBase.kind`

***

### next

> **next**: `string`[]

Defined in: [engine/src/components/VisualScriptComponent.ts:28](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/VisualScriptComponent.ts#L28)

Node ids wired to this node's execution output(s), in port order.

#### Inherited from

`VSNodeBase.next`

***

### value

> **value**: `number`

Defined in: [engine/src/components/VisualScriptComponent.ts:49](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/VisualScriptComponent.ts#L49)

***

### variableIndex

> **variableIndex**: `number`

Defined in: [engine/src/components/VisualScriptComponent.ts:47](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/VisualScriptComponent.ts#L47)

Variable index (VariableStore) compared against `value`.

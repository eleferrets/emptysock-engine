[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / BranchNode

# Interface: BranchNode

Defined in: engine/src/components/VisualScript.ts:42

## Extends

- `VSNodeBase`

## Properties

### comparator

> **comparator**: `"eq"` \| `"neq"` \| `"gt"` \| `"gte"` \| `"lt"` \| `"lte"`

Defined in: engine/src/components/VisualScript.ts:46

***

### id

> **id**: `string`

Defined in: engine/src/components/VisualScript.ts:23

#### Inherited from

`VSNodeBase.id`

***

### kind

> **kind**: `"branch"`

Defined in: engine/src/components/VisualScript.ts:43

#### Overrides

`VSNodeBase.kind`

***

### next

> **next**: `string`[]

Defined in: engine/src/components/VisualScript.ts:26

Node ids wired to this node's execution output(s), in port order.

#### Inherited from

`VSNodeBase.next`

***

### value

> **value**: `number`

Defined in: engine/src/components/VisualScript.ts:47

***

### variableIndex

> **variableIndex**: `number`

Defined in: engine/src/components/VisualScript.ts:45

Variable index (VariableStore) compared against `value`.

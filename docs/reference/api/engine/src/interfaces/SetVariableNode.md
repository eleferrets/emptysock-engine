[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / SetVariableNode

# Interface: SetVariableNode

Defined in: engine/src/components/VisualScript.ts:58

## Extends

- `VSNodeBase`

## Properties

### id

> **id**: `string`

Defined in: engine/src/components/VisualScript.ts:23

#### Inherited from

`VSNodeBase.id`

***

### kind

> **kind**: `"setVariable"`

Defined in: engine/src/components/VisualScript.ts:59

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

> **value**: `number` \| \{ `fromKey`: `string`; \}

Defined in: engine/src/components/VisualScript.ts:62

Literal value, or an evaluation-scope key produced by an earlier getVariable node.

***

### variableIndex

> **variableIndex**: `number`

Defined in: engine/src/components/VisualScript.ts:60

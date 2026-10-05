[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / GetVariableNode

# Interface: GetVariableNode

Defined in: engine/src/components/VisualScript.ts:51

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

> **kind**: `"getVariable"`

Defined in: engine/src/components/VisualScript.ts:52

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

### outputKey

> **outputKey**: `string`

Defined in: engine/src/components/VisualScript.ts:55

Result is written into this evaluation-scope key for downstream nodes.

***

### variableIndex

> **variableIndex**: `number`

Defined in: engine/src/components/VisualScript.ts:53

[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / GetVariableNode

# Interface: GetVariableNode

Defined in: [engine/src/components/VisualScriptComponent.ts:53](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L53)

## Extends

- `VSNodeBase`

## Properties

### id

> **id**: `string`

Defined in: [engine/src/components/VisualScriptComponent.ts:25](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L25)

#### Inherited from

`VSNodeBase.id`

***

### kind

> **kind**: `"getVariable"`

Defined in: [engine/src/components/VisualScriptComponent.ts:54](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L54)

#### Overrides

`VSNodeBase.kind`

***

### next

> **next**: `string`[]

Defined in: [engine/src/components/VisualScriptComponent.ts:28](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L28)

Node ids wired to this node's execution output(s), in port order.

#### Inherited from

`VSNodeBase.next`

***

### outputKey

> **outputKey**: `string`

Defined in: [engine/src/components/VisualScriptComponent.ts:57](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L57)

Result is written into this evaluation-scope key for downstream nodes.

***

### variableIndex

> **variableIndex**: `number`

Defined in: [engine/src/components/VisualScriptComponent.ts:55](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L55)

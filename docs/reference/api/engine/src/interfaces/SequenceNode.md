[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / SequenceNode

# Interface: SequenceNode

Defined in: [engine/src/components/VisualScriptComponent.ts:40](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L40)

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

> **kind**: `"sequence"`

Defined in: [engine/src/components/VisualScriptComponent.ts:41](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L41)

#### Overrides

`VSNodeBase.kind`

***

### next

> **next**: `string`[]

Defined in: [engine/src/components/VisualScriptComponent.ts:28](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L28)

Node ids wired to this node's execution output(s), in port order.

#### Inherited from

`VSNodeBase.next`

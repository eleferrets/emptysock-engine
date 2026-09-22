[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / OnEventNode

# Interface: OnEventNode

Defined in: [engine/src/components/VisualScriptComponent.ts:35](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L35)

## Extends

- `VSNodeBase`

## Properties

### eventType

> **eventType**: `string`

Defined in: [engine/src/components/VisualScriptComponent.ts:37](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L37)

***

### id

> **id**: `string`

Defined in: [engine/src/components/VisualScriptComponent.ts:25](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L25)

#### Inherited from

`VSNodeBase.id`

***

### kind

> **kind**: `"onEvent"`

Defined in: [engine/src/components/VisualScriptComponent.ts:36](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L36)

#### Overrides

`VSNodeBase.kind`

***

### next

> **next**: `string`[]

Defined in: [engine/src/components/VisualScriptComponent.ts:28](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L28)

Node ids wired to this node's execution output(s), in port order.

#### Inherited from

`VSNodeBase.next`

[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / SendMessageNode

# Interface: SendMessageNode

Defined in: [engine/src/components/VisualScriptComponent.ts:79](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L79)

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

> **kind**: `"sendMessage"`

Defined in: [engine/src/components/VisualScriptComponent.ts:80](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L80)

#### Overrides

`VSNodeBase.kind`

***

### messageType

> **messageType**: `string`

Defined in: [engine/src/components/VisualScriptComponent.ts:82](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L82)

***

### next

> **next**: `string`[]

Defined in: [engine/src/components/VisualScriptComponent.ts:28](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L28)

Node ids wired to this node's execution output(s), in port order.

#### Inherited from

`VSNodeBase.next`

***

### payload?

> `optional` **payload?**: `Record`\<`string`, `unknown`\>

Defined in: [engine/src/components/VisualScriptComponent.ts:84](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L84)

Extra fields merged into the outgoing Message.

***

### targetActorId

> **targetActorId**: `string`

Defined in: [engine/src/components/VisualScriptComponent.ts:81](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L81)

[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / SendMessageNode

# Interface: SendMessageNode

Defined in: engine/src/components/VisualScript.ts:77

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

> **kind**: `"sendMessage"`

Defined in: engine/src/components/VisualScript.ts:78

#### Overrides

`VSNodeBase.kind`

***

### messageType

> **messageType**: `string`

Defined in: engine/src/components/VisualScript.ts:80

***

### next

> **next**: `string`[]

Defined in: engine/src/components/VisualScript.ts:26

Node ids wired to this node's execution output(s), in port order.

#### Inherited from

`VSNodeBase.next`

***

### payload?

> `optional` **payload?**: `Record`\<`string`, `unknown`\>

Defined in: engine/src/components/VisualScript.ts:82

Extra fields merged into the outgoing Message.

***

### targetActorId

> **targetActorId**: `string`

Defined in: engine/src/components/VisualScript.ts:79

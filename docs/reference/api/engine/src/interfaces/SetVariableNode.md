[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / SetVariableNode

# Interface: SetVariableNode

Defined in: [engine/src/components/VisualScriptComponent.ts:60](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/VisualScriptComponent.ts#L60)

## Extends

- `VSNodeBase`

## Properties

### id

> **id**: `string`

Defined in: [engine/src/components/VisualScriptComponent.ts:25](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/VisualScriptComponent.ts#L25)

#### Inherited from

`VSNodeBase.id`

***

### kind

> **kind**: `"setVariable"`

Defined in: [engine/src/components/VisualScriptComponent.ts:61](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/VisualScriptComponent.ts#L61)

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

> **value**: `number` \| \{ `fromKey`: `string`; \}

Defined in: [engine/src/components/VisualScriptComponent.ts:64](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/VisualScriptComponent.ts#L64)

Literal value, or an evaluation-scope key produced by an earlier getVariable node.

***

### variableIndex

> **variableIndex**: `number`

Defined in: [engine/src/components/VisualScriptComponent.ts:62](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/VisualScriptComponent.ts#L62)

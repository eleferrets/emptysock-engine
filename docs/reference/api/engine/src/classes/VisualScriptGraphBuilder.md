[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / VisualScriptGraphBuilder

# Class: VisualScriptGraphBuilder

Defined in: [engine/src/components/VisualScriptComponent.ts:116](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L116)

Fluent, code-first builder that produces the exact VisualScriptGraph shape
the panel authors and round-trips. Lets a developer hand-write a graph
instead of drawing it.

## Constructors

### Constructor

> **new VisualScriptGraphBuilder**(): `VisualScriptGraphBuilder`

#### Returns

`VisualScriptGraphBuilder`

## Methods

### branch()

> **branch**(`variableIndex`, `comparator`, `value`, `id?`): [`BranchNode`](../interfaces/BranchNode.md)

Defined in: [engine/src/components/VisualScriptComponent.ts:144](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L144)

#### Parameters

##### variableIndex

`number`

##### comparator

`"eq"` \| `"neq"` \| `"gt"` \| `"lt"` \| `"gte"` \| `"lte"`

##### value

`number`

##### id?

`string` = `...`

#### Returns

[`BranchNode`](../interfaces/BranchNode.md)

***

### build()

> **build**(): [`VisualScriptGraph`](../interfaces/VisualScriptGraph.md)

Defined in: [engine/src/components/VisualScriptComponent.ts:235](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L235)

#### Returns

[`VisualScriptGraph`](../interfaces/VisualScriptGraph.md)

***

### connect()

> **connect**(`from`, `to`, `fromPort?`): `this`

Defined in: [engine/src/components/VisualScriptComponent.ts:228](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L228)

Wire `from`'s execution output (port 0, or the true/false branch port for BranchNode) to `to`.

#### Parameters

##### from

[`VSNode`](../type-aliases/VSNode.md)

##### to

[`VSNode`](../type-aliases/VSNode.md)

##### fromPort?

`number` = `0`

#### Returns

`this`

***

### getSwitch()

> **getSwitch**(`switchIndex`, `outputKey`, `id?`): [`GetSwitchNode`](../interfaces/GetSwitchNode.md)

Defined in: [engine/src/components/VisualScriptComponent.ts:185](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L185)

#### Parameters

##### switchIndex

`number`

##### outputKey

`string`

##### id?

`string` = `...`

#### Returns

[`GetSwitchNode`](../interfaces/GetSwitchNode.md)

***

### getVariable()

> **getVariable**(`variableIndex`, `outputKey`, `id?`): [`GetVariableNode`](../interfaces/GetVariableNode.md)

Defined in: [engine/src/components/VisualScriptComponent.ts:159](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L159)

#### Parameters

##### variableIndex

`number`

##### outputKey

`string`

##### id?

`string` = `...`

#### Returns

[`GetVariableNode`](../interfaces/GetVariableNode.md)

***

### onEvent()

> **onEvent**(`eventType`, `id?`): [`OnEventNode`](../interfaces/OnEventNode.md)

Defined in: [engine/src/components/VisualScriptComponent.ts:136](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L136)

#### Parameters

##### eventType

`string`

##### id?

`string` = `...`

#### Returns

[`OnEventNode`](../interfaces/OnEventNode.md)

***

### onUpdate()

> **onUpdate**(`id?`): [`OnUpdateNode`](../interfaces/OnUpdateNode.md)

Defined in: [engine/src/components/VisualScriptComponent.ts:132](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L132)

#### Parameters

##### id?

`string` = `...`

#### Returns

[`OnUpdateNode`](../interfaces/OnUpdateNode.md)

***

### sendMessage()

> **sendMessage**(`targetActorId`, `messageType`, `payload?`, `id?`): [`SendMessageNode`](../interfaces/SendMessageNode.md)

Defined in: [engine/src/components/VisualScriptComponent.ts:211](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L211)

#### Parameters

##### targetActorId

`string`

##### messageType

`string`

##### payload?

`Record`\<`string`, `unknown`\>

##### id?

`string` = `...`

#### Returns

[`SendMessageNode`](../interfaces/SendMessageNode.md)

***

### sequence()

> **sequence**(`id?`): [`SequenceNode`](../interfaces/SequenceNode.md)

Defined in: [engine/src/components/VisualScriptComponent.ts:140](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L140)

#### Parameters

##### id?

`string` = `...`

#### Returns

[`SequenceNode`](../interfaces/SequenceNode.md)

***

### setSwitch()

> **setSwitch**(`switchIndex`, `value`, `id?`): [`SetSwitchNode`](../interfaces/SetSwitchNode.md)

Defined in: [engine/src/components/VisualScriptComponent.ts:198](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L198)

#### Parameters

##### switchIndex

`number`

##### value

`boolean`

##### id?

`string` = `...`

#### Returns

[`SetSwitchNode`](../interfaces/SetSwitchNode.md)

***

### setVariable()

> **setVariable**(`variableIndex`, `value`, `id?`): [`SetVariableNode`](../interfaces/SetVariableNode.md)

Defined in: [engine/src/components/VisualScriptComponent.ts:172](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L172)

#### Parameters

##### variableIndex

`number`

##### value

`number` \| \{ `fromKey`: `string`; \}

##### id?

`string` = `...`

#### Returns

[`SetVariableNode`](../interfaces/SetVariableNode.md)

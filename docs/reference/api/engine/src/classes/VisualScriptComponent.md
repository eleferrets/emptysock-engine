[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / VisualScriptComponent

# Class: VisualScriptComponent

Defined in: [engine/src/components/VisualScriptComponent.ts:259](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L259)

Per-entity component that holds a serialized VisualScriptGraph and
interprets it. Registered under ComponentType "VisualScript" like any
other Component — addComponent/getComponent key off that string.

Execution model:
- onUpdate nodes fire once every update() call (every frame).
- onEvent nodes fire when fireEvent(eventType) is called.
- From a trigger node, execution walks `next` edges synchronously,
  following sequence/branch/data/action nodes until it reaches a node
  with no outgoing edge for the taken port, or MAX_STEPS_PER_TICK is hit
  (a defensive cap against a graph that cycles back into itself, mirroring
  the ActorSystem mailbox-drain guidance in CLAUDE.md).

## Extends

- [`Component`](Component.md)

## Constructors

### Constructor

> **new VisualScriptComponent**(`options`): `VisualScriptComponent`

Defined in: [engine/src/components/VisualScriptComponent.ts:267](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L267)

#### Parameters

##### options

###### actorSystem?

[`ActorSystem`](ActorSystem.md)

###### graph

[`VisualScriptGraph`](../interfaces/VisualScriptGraph.md)

###### variableStore?

[`VariableStore`](VariableStore.md)

#### Returns

`VisualScriptComponent`

#### Overrides

[`Component`](Component.md).[`constructor`](Component.md#constructor)

## Properties

### enabled

> **enabled**: `boolean` = `true`

Defined in: [engine/src/core/Component.ts:23](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Component.ts#L23)

#### Inherited from

[`Component`](Component.md).[`enabled`](Component.md#enabled)

***

### type

> `readonly` **type**: `string`

Defined in: [engine/src/core/Component.ts:22](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Component.ts#L22)

#### Inherited from

[`Component`](Component.md).[`type`](Component.md#type)

***

### TYPE

> `readonly` `static` **TYPE**: `"VisualScript"` = `"VisualScript"`

Defined in: [engine/src/components/VisualScriptComponent.ts:260](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L260)

## Accessors

### graph

#### Get Signature

> **get** **graph**(): [`VisualScriptGraph`](../interfaces/VisualScriptGraph.md)

Defined in: [engine/src/components/VisualScriptComponent.ts:278](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L278)

##### Returns

[`VisualScriptGraph`](../interfaces/VisualScriptGraph.md)

***

### variableStore

#### Get Signature

> **get** **variableStore**(): [`VariableStore`](VariableStore.md)

Defined in: [engine/src/components/VisualScriptComponent.ts:290](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L290)

##### Returns

[`VariableStore`](VariableStore.md)

## Methods

### fireEvent()

> **fireEvent**(`eventType`): `void`

Defined in: [engine/src/components/VisualScriptComponent.ts:304](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L304)

Fire every onEvent node whose eventType matches.

#### Parameters

##### eventType

`string`

#### Returns

`void`

***

### onAttach()?

> `optional` **onAttach**(): `void`

Defined in: [engine/src/core/Component.ts:30](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Component.ts#L30)

Called once when component is first attached to an entity

#### Returns

`void`

#### Inherited from

[`Component`](Component.md).[`onAttach`](Component.md#onattach)

***

### onDetach()?

> `optional` **onDetach**(): `void`

Defined in: [engine/src/core/Component.ts:33](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Component.ts#L33)

Called once when component is detached from an entity

#### Returns

`void`

#### Inherited from

[`Component`](Component.md).[`onDetach`](Component.md#ondetach)

***

### serialize()

> **serialize**(): `Record`\<`string`, `unknown`\>

Defined in: [engine/src/components/VisualScriptComponent.ts:391](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L391)

Serialize component data for saving

#### Returns

`Record`\<`string`, `unknown`\>

#### Overrides

[`Component`](Component.md).[`serialize`](Component.md#serialize)

***

### setActorSystem()

> **setActorSystem**(`actorSystem`): `void`

Defined in: [engine/src/components/VisualScriptComponent.ts:286](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L286)

#### Parameters

##### actorSystem

[`ActorSystem`](ActorSystem.md)

#### Returns

`void`

***

### setGraph()

> **setGraph**(`graph`): `void`

Defined in: [engine/src/components/VisualScriptComponent.ts:282](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L282)

#### Parameters

##### graph

[`VisualScriptGraph`](../interfaces/VisualScriptGraph.md)

#### Returns

`void`

***

### update()

> **update**(`_deltaTime`): `void`

Defined in: [engine/src/components/VisualScriptComponent.ts:294](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/VisualScriptComponent.ts#L294)

Called each frame during the update pass

#### Parameters

##### \_deltaTime

`number`

#### Returns

`void`

#### Overrides

[`Component`](Component.md).[`update`](Component.md#update)

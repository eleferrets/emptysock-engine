[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / CompiledVisualScriptComponent

# Class: CompiledVisualScriptComponent

Defined in: [engine/src/systems/VisualScriptCompiler.ts:255](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/VisualScriptCompiler.ts#L255)

Drop-in replacement for VisualScriptComponent that runs *compiled* code
instead of interpreting the graph node-by-node every frame. Same public
shape (graph/setGraph/setActorSystem/variableStore/update/fireEvent/
serialize) so it can be substituted anywhere a VisualScriptComponent is
used. VisualScriptComponent itself is unchanged and still the default —
see CLAUDE.md for why both exist.

## Extends

- [`Component`](Component.md)

## Constructors

### Constructor

> **new CompiledVisualScriptComponent**(`options`): `CompiledVisualScriptComponent`

Defined in: [engine/src/systems/VisualScriptCompiler.ts:265](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/VisualScriptCompiler.ts#L265)

#### Parameters

##### options

###### actorSystem?

[`ActorSystem`](ActorSystem.md)

###### graph

[`VisualScriptGraph`](../interfaces/VisualScriptGraph.md)

###### variableStore?

[`VariableStore`](VariableStore.md)

#### Returns

`CompiledVisualScriptComponent`

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

Defined in: [engine/src/systems/VisualScriptCompiler.ts:256](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/VisualScriptCompiler.ts#L256)

## Accessors

### compiledSource

#### Get Signature

> **get** **compiledSource**(): `string`

Defined in: [engine/src/systems/VisualScriptCompiler.ts:283](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/VisualScriptCompiler.ts#L283)

The generated JavaScript source currently backing this component.

##### Returns

`string`

***

### graph

#### Get Signature

> **get** **graph**(): [`VisualScriptGraph`](../interfaces/VisualScriptGraph.md)

Defined in: [engine/src/systems/VisualScriptCompiler.ts:278](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/VisualScriptCompiler.ts#L278)

##### Returns

[`VisualScriptGraph`](../interfaces/VisualScriptGraph.md)

***

### variableStore

#### Get Signature

> **get** **variableStore**(): [`VariableStore`](VariableStore.md)

Defined in: [engine/src/systems/VisualScriptCompiler.ts:297](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/VisualScriptCompiler.ts#L297)

##### Returns

[`VariableStore`](VariableStore.md)

## Methods

### fireEvent()

> **fireEvent**(`eventType`): `void`

Defined in: [engine/src/systems/VisualScriptCompiler.ts:313](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/VisualScriptCompiler.ts#L313)

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

Defined in: [engine/src/systems/VisualScriptCompiler.ts:317](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/VisualScriptCompiler.ts#L317)

Serialize component data for saving

#### Returns

`Record`\<`string`, `unknown`\>

#### Overrides

[`Component`](Component.md).[`serialize`](Component.md#serialize)

***

### setActorSystem()

> **setActorSystem**(`actorSystem`): `void`

Defined in: [engine/src/systems/VisualScriptCompiler.ts:293](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/VisualScriptCompiler.ts#L293)

#### Parameters

##### actorSystem

[`ActorSystem`](ActorSystem.md)

#### Returns

`void`

***

### setGraph()

> **setGraph**(`graph`): `void`

Defined in: [engine/src/systems/VisualScriptCompiler.ts:287](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/VisualScriptCompiler.ts#L287)

#### Parameters

##### graph

[`VisualScriptGraph`](../interfaces/VisualScriptGraph.md)

#### Returns

`void`

***

### update()

> **update**(`_deltaTime`): `void`

Defined in: [engine/src/systems/VisualScriptCompiler.ts:309](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/VisualScriptCompiler.ts#L309)

Called each frame during the update pass

#### Parameters

##### \_deltaTime

`number`

#### Returns

`void`

#### Overrides

[`Component`](Component.md).[`update`](Component.md#update)

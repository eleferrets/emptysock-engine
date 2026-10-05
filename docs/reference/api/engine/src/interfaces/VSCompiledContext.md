[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / VSCompiledContext

# Interface: VSCompiledContext

Defined in: engine/src/systems/VisualScriptSystem.ts:33

## Properties

### actorSystem

> **actorSystem**: [`ActorSystem`](../classes/ActorSystem.md) \| `null`

Defined in: engine/src/systems/VisualScriptSystem.ts:35

***

### scope

> **scope**: `Map`\<`string`, `number`\>

Defined in: engine/src/systems/VisualScriptSystem.ts:37

Per-trigger-run evaluation scope, cleared before each onUpdate/onEvent chain.

***

### variables

> **variables**: [`VariableStore`](../classes/VariableStore.md)

Defined in: engine/src/systems/VisualScriptSystem.ts:34

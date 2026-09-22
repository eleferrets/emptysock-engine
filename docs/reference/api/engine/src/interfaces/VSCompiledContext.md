[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / VSCompiledContext

# Interface: VSCompiledContext

Defined in: [engine/src/systems/VisualScriptCompiler.ts:37](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/VisualScriptCompiler.ts#L37)

## Properties

### actorSystem

> **actorSystem**: [`ActorSystem`](../classes/ActorSystem.md) \| `null`

Defined in: [engine/src/systems/VisualScriptCompiler.ts:39](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/VisualScriptCompiler.ts#L39)

***

### scope

> **scope**: `Map`\<`string`, `number`\>

Defined in: [engine/src/systems/VisualScriptCompiler.ts:41](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/VisualScriptCompiler.ts#L41)

Per-trigger-run evaluation scope, cleared before each onUpdate/onEvent chain.

***

### variables

> **variables**: [`VariableStore`](../classes/VariableStore.md)

Defined in: [engine/src/systems/VisualScriptCompiler.ts:38](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/VisualScriptCompiler.ts#L38)

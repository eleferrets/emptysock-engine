[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / VSCompiledContext

# Interface: VSCompiledContext

Defined in: [engine/src/systems/VisualScriptCompiler.ts:37](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/VisualScriptCompiler.ts#L37)

## Properties

### actorSystem

> **actorSystem**: [`ActorSystem`](../classes/ActorSystem.md) \| `null`

Defined in: [engine/src/systems/VisualScriptCompiler.ts:39](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/VisualScriptCompiler.ts#L39)

***

### scope

> **scope**: `Map`\<`string`, `number`\>

Defined in: [engine/src/systems/VisualScriptCompiler.ts:41](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/VisualScriptCompiler.ts#L41)

Per-trigger-run evaluation scope, cleared before each onUpdate/onEvent chain.

***

### variables

> **variables**: [`VariableStore`](../classes/VariableStore.md)

Defined in: [engine/src/systems/VisualScriptCompiler.ts:38](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/VisualScriptCompiler.ts#L38)

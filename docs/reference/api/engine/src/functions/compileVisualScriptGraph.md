[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / compileVisualScriptGraph

# Function: compileVisualScriptGraph()

> **compileVisualScriptGraph**(`graph`): `string`

Defined in: [engine/src/systems/VisualScriptCompiler.ts:196](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/VisualScriptCompiler.ts#L196)

Compiles a VisualScriptGraph to a self-contained CommonJS-style module
source string exporting `run(ctx)` (drives every onUpdate chain) and
`fireEvent(eventType, ctx)` (drives every matching onEvent chain).

## Parameters

### graph

[`VisualScriptGraph`](../interfaces/VisualScriptGraph.md)

## Returns

`string`

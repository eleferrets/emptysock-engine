[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / compileVisualScriptGraph

# Function: compileVisualScriptGraph()

> **compileVisualScriptGraph**(`graph`): `string`

Defined in: [engine/src/systems/VisualScriptCompiler.ts:196](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/VisualScriptCompiler.ts#L196)

Compiles a VisualScriptGraph to a self-contained CommonJS-style module
source string exporting `run(ctx)` (drives every onUpdate chain) and
`fireEvent(eventType, ctx)` (drives every matching onEvent chain).

## Parameters

### graph

[`VisualScriptGraph`](../interfaces/VisualScriptGraph.md)

## Returns

`string`

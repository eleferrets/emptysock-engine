[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / compileVisualScriptGraph

# Function: compileVisualScriptGraph()

> **compileVisualScriptGraph**(`graph`): `string`

Defined in: engine/src/systems/VisualScriptSystem.ts:192

Compiles a `VisualScriptGraph` to a self-contained CommonJS-style module
source string exporting `run(ctx)` (drives every onUpdate chain) and
`fireEvent(eventType, ctx)` (drives every matching onEvent chain).

## Parameters

### graph

[`VisualScriptGraph`](../interfaces/VisualScriptGraph.md)

## Returns

`string`

[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / VSNodeKind

# Type Alias: VSNodeKind

> **VSNodeKind** = `"onUpdate"` \| `"onEvent"` \| `"sequence"` \| `"branch"` \| `"getVariable"` \| `"setVariable"` \| `"getSwitch"` \| `"setSwitch"` \| `"sendMessage"`

Defined in: engine/src/components/VisualScript.ts:11

Node graph shape produced by the Visual Script Editor panel, and equally
constructible by hand in game code (see `VisualScriptGraphBuilder` below).
This is the single source of truth for what a graph "is" — the panel and
`VisualScriptSystem`'s compiler both serialize/consume exactly this shape.

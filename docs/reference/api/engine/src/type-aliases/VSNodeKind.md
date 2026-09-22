[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / VSNodeKind

# Type Alias: VSNodeKind

> **VSNodeKind** = `"onUpdate"` \| `"onEvent"` \| `"sequence"` \| `"branch"` \| `"getVariable"` \| `"setVariable"` \| `"getSwitch"` \| `"setSwitch"` \| `"sendMessage"`

Defined in: [engine/src/components/VisualScriptComponent.ts:13](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/VisualScriptComponent.ts#L13)

Node graph shape produced by the Visual Script Editor panel, and equally
constructible by hand in game code (see VisualScriptGraphBuilder below).
This is the single source of truth for what a graph "is" — the panel and
the interpreter both serialize/consume exactly this shape.

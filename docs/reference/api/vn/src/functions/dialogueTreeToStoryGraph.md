[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [vn/src](../README.md) / dialogueTreeToStoryGraph

# Function: dialogueTreeToStoryGraph()

> **dialogueTreeToStoryGraph**(`tree`): [`StoryGraph`](../interfaces/StoryGraph.md)

Defined in: [vn/src/VNScriptConvert.ts:143](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/vn/src/VNScriptConvert.ts#L143)

Convert a VNSystem DialogueTree (.vnscript JSON) back into a Story Graph for
display in the IDE's Story Graph editor. Positional data is auto-generated
with a simple left-to-right BFS layout.

Lossless for dialogue, choice (including per-option `when`), and condition
nodes. Event nodes are represented as dialogue nodes tagged
`[event: eventName]`. Jump nodes are omitted — the target's edge is
followed directly.

## Parameters

### tree

[`DialogueTree`](../interfaces/DialogueTree.md)

## Returns

[`StoryGraph`](../interfaces/StoryGraph.md)

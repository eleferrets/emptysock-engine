[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [vn/src](../README.md) / storyGraphToDialogueTree

# Function: storyGraphToDialogueTree()

> **storyGraphToDialogueTree**(`graph`): [`DialogueTree`](../interfaces/DialogueTree.md)

Defined in: vn/src/VNScriptConvert.ts:47

Convert a Story Graph (visual-editor format) to a VNSystem DialogueTree
(.vnscript JSON). The returned tree is ready to pass to `new VNSystem().load()`.

Lossless for dialogue, choice (including per-option `when`), condition, and
jump nodes. Positional data (x, y) is dropped — it is preserved in the
Story Graph format only.

## Parameters

### graph

[`StoryGraph`](../interfaces/StoryGraph.md)

## Returns

[`DialogueTree`](../interfaces/DialogueTree.md)

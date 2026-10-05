[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [vn/src](../README.md) / StoryGraphNode

# Interface: StoryGraphNode

Defined in: vn/src/VNScriptConvert.ts:6

## Properties

### condition?

> `optional` **condition?**: `VariableCondition`

Defined in: vn/src/VNScriptConvert.ts:21

Present only on `"condition"` nodes — the gate evaluated to pick a branch.

***

### id

> **id**: `string`

Defined in: vn/src/VNScriptConvert.ts:7

***

### options?

> `optional` **options?**: `string`[]

Defined in: vn/src/VNScriptConvert.ts:13

***

### optionWhens?

> `optional` **optionWhens?**: (`VariableCondition` \| `undefined`)[]

Defined in: vn/src/VNScriptConvert.ts:19

Per-option `when` gate, aligned by index with `options`. Present only on
`"choice"` nodes; an `undefined` entry (or a shorter/absent array) means
that option has no condition and is always shown.

***

### speaker?

> `optional` **speaker?**: `string`

Defined in: vn/src/VNScriptConvert.ts:11

***

### text

> **text**: `string`

Defined in: vn/src/VNScriptConvert.ts:12

***

### type

> **type**: `"condition"` \| `"dialogue"` \| `"choice"`

Defined in: vn/src/VNScriptConvert.ts:8

***

### x

> **x**: `number`

Defined in: vn/src/VNScriptConvert.ts:9

***

### y

> **y**: `number`

Defined in: vn/src/VNScriptConvert.ts:10

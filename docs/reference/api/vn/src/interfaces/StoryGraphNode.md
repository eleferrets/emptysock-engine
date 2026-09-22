[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [vn/src](../README.md) / StoryGraphNode

# Interface: StoryGraphNode

Defined in: [vn/src/VNScriptConvert.ts:6](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/vn/src/VNScriptConvert.ts#L6)

## Properties

### condition?

> `optional` **condition?**: `VariableCondition`

Defined in: [vn/src/VNScriptConvert.ts:21](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/vn/src/VNScriptConvert.ts#L21)

Present only on `"condition"` nodes — the gate evaluated to pick a branch.

***

### id

> **id**: `string`

Defined in: [vn/src/VNScriptConvert.ts:7](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/vn/src/VNScriptConvert.ts#L7)

***

### options?

> `optional` **options?**: `string`[]

Defined in: [vn/src/VNScriptConvert.ts:13](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/vn/src/VNScriptConvert.ts#L13)

***

### optionWhens?

> `optional` **optionWhens?**: (`VariableCondition` \| `undefined`)[]

Defined in: [vn/src/VNScriptConvert.ts:19](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/vn/src/VNScriptConvert.ts#L19)

Per-option `when` gate, aligned by index with `options`. Present only on
`"choice"` nodes; an `undefined` entry (or a shorter/absent array) means
that option has no condition and is always shown.

***

### speaker?

> `optional` **speaker?**: `string`

Defined in: [vn/src/VNScriptConvert.ts:11](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/vn/src/VNScriptConvert.ts#L11)

***

### text

> **text**: `string`

Defined in: [vn/src/VNScriptConvert.ts:12](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/vn/src/VNScriptConvert.ts#L12)

***

### type

> **type**: `"condition"` \| `"dialogue"` \| `"choice"`

Defined in: [vn/src/VNScriptConvert.ts:8](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/vn/src/VNScriptConvert.ts#L8)

***

### x

> **x**: `number`

Defined in: [vn/src/VNScriptConvert.ts:9](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/vn/src/VNScriptConvert.ts#L9)

***

### y

> **y**: `number`

Defined in: [vn/src/VNScriptConvert.ts:10](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/vn/src/VNScriptConvert.ts#L10)

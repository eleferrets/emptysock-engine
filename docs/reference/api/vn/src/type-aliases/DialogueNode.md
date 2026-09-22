[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [vn/src](../README.md) / DialogueNode

# Type Alias: DialogueNode

> **DialogueNode** = \{ `cgPath?`: `string`; `next?`: `string`; `speaker`: `string`; `text`: `string`; `type`: `"dialogue"`; `voice?`: `string`; \} \| \{ `cgPath?`: `string`; `options`: `object`[]; `text`: `string`; `type`: `"choice"`; \} \| \{ `cgPath?`: `string`; `data?`: `Record`\<`string`, `unknown`\>; `eventName`: `string`; `next?`: `string`; `type`: `"event"`; \} \| \{ `cgPath?`: `string`; `target`: `string`; `type`: `"jump"`; \} \| \{ `cgPath?`: `string`; `next?`: `string`; `type`: `"variable-set"`; `variableKey`: `string`; `variableValue`: `unknown`; \} \| \{ `cgPath?`: `string`; `condition`: `VariableCondition`; `ifFalse?`: `string`; `ifTrue`: `string`; `type`: `"condition"`; \}

Defined in: [vn/src/VNSystem.ts:10](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/vn/src/VNSystem.ts#L10)

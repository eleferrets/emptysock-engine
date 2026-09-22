[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / VariableCondition

# Type Alias: VariableCondition

> **VariableCondition** = \{ `equals`: `boolean`; `index`: `number`; `kind`: `"switch"`; \} \| \{ `index`: `number`; `kind`: `"variable"`; `op`: `"eq"` \| `"neq"` \| `"gt"` \| `"gte"` \| `"lt"` \| `"lte"`; `value`: `number`; \}

Defined in: [engine/src/systems/VariableStore.ts:154](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/VariableStore.ts#L154)

A condition evaluated against a `VariableStore`, used to gate branches in
`VNSystem` (condition nodes, conditional choice options) and triggers in
`MapEventSystem` (the `when` field on a `MapEvent`).

- `"switch"` compares a boolean switch to an expected value.
- `"variable"` compares an integer variable to a value with a comparison operator.

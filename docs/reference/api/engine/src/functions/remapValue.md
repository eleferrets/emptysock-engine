[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / remapValue

# Function: remapValue()

> **remapValue**(`value`, `leaf`, `maxDepth?`, `visited?`): `unknown`

Defined in: engine/src/RefRemap.ts:125

Walks `value` (arrays and plain objects, to a fixed depth of 8, with a
visited set so cycles are safe), replacing every leaf `leaf` claims.
Containers are mutated in place; the (possibly replaced) top-level value is
returned. Class instances that `leaf` does not claim are left alone. Used
for untyped payloads such as per-instance variables, where no schema says
which fields hold references.

## Parameters

### value

`unknown`

### leaf

[`RemapLeaf`](../type-aliases/RemapLeaf.md)

### maxDepth?

`number` = `MAX_DEPTH`

### visited?

`Set`\<`object`\> = `...`

## Returns

`unknown`

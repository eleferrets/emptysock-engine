[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / ComponentSchema

# Type Alias: ComponentSchema\<T\>

> **ComponentSchema**\<`T`\> = `{ readonly [K in keyof T]?: ComponentFieldSchema }`

Defined in: engine/src/Component.ts:33

A component's schema maps each field name in its defaults object to a
`ComponentFieldSchema`. It is optional and purely additive — a component
with no `.schema` still works everywhere; the Inspector falls back to a
raw per-field editor for it. A schema does not need to cover every field
(e.g. `PhysicsBody`'s `bodyHandle`/`colliderHandle` are engine-managed and
usually omitted); an unlisted field also falls back to the raw editor.

## Type Parameters

### T

`T` *extends* [`SerializableRecord`](SerializableRecord.md)

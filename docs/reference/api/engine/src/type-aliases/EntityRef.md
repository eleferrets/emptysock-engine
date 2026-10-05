[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / EntityRef

# Type Alias: EntityRef

> **EntityRef** = `object`

Defined in: engine/src/EntityRef.ts:13

Stable, serialisable reference to an entity within one `Scene`
.

A plain object so it satisfies `Serializable` and survives a JSON round
trip. `$ref` is a per-scene `EntityId`: a monotonic counter that is never
reused, unlike the bitECS eid (recycled) or `Entity.rawId` (version bits
stripped). `0` means "no reference". Resolve with `scene.resolve(ref)`.

## Properties

### $ref

> `readonly` **$ref**: `number`

Defined in: engine/src/EntityRef.ts:13

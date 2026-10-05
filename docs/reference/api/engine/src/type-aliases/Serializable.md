[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / Serializable

# Type Alias: Serializable

> **Serializable** = `string` \| `number` \| `boolean` \| `null` \| `undefined` \| readonly `Serializable`[] \| \{\[`key`: `string`\]: `Serializable`; \}

Defined in: engine/src/Serializable.ts:13

the engine design notes — the plain-data constraint every component field
must satisfy. This is the type used to constrain `defineComponent`'s
defaults object: no functions, no class instances (unless they implement
`SerializableHooks` themselves via a custom field type — out of scope for
Track 0, which only lands the constraint, not `SaveSystem`).

A component that only ever holds `Serializable` fields can be saved/loaded
generically by a future `SaveSystem` with zero per-component code. The
`serialize`/`deserialize` escape hatch mentioned in the engine design notes
belongs to that later system, not this type.

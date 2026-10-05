[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / TargetDestroyedPolicy

# Type Alias: TargetDestroyedPolicy

> **TargetDestroyedPolicy** = `"remove"` \| `"destroy"`

Defined in: engine/src/Relations.ts:24

What happens to a subject when the target of one of its edges is
destroyed.

- `"remove"`: only the edge is dropped; the subject lives on.
- `"destroy"`: the subject is destroyed too, through `Scene.destroy`, so
  its side tables, pool return and own relations are cleaned up.

bitECS always drops a pair when its target dies; the cascade is done by
the engine rather than bitECS's `withAutoRemoveSubject`, because that
modifier removes the subject with the raw bitECS `removeEntity`, bypassing
`Scene.destroy` (the engine's per-entity side tables would leak).

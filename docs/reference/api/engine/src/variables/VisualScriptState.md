[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / VisualScriptState

# Variable: VisualScriptState

> `const` **VisualScriptState**: [`ComponentDef`](../interfaces/ComponentDef.md)\<\{ `graphId`: `string`; \}\>

Defined in: engine/src/components/VisualScript.ts:261

`VisualScriptState` is
defined via `defineComponent`'s `SerializableRecord` constraint, which
rules out storing the graph itself (nodes/connections, functions and all)
directly on the component.

Per the research that informed this design (production ECS engines —
Unity DOTS's `EntitiesBT`/`DOTS-BehaviorTree`, Bevy's `bevy_behavior` —
all converge on the same shape): the graph itself is treated as shared,
immutable data, not per-entity component state. Two entities running the
same authored graph reference the same `graphId`, never a duplicated copy
of `nodes`/`connections` sitting in bitECS's own parallel arrays (which
would also violate `Serializable`'s "no functions, no arbitrary nested
object graphs" spirit for anything non-trivial). `VisualScriptState` is
intentionally the small per-entity part only: which graph this entity is
running. `registerVisualScriptGraph`/`getVisualScriptGraph` hold the
actual graph data in a plain module-level registry, the same "shared
static data keyed by id" pattern `@emptysock/network`'s `NetworkedFields`
side-map and `TilemapSystem`'s tilemap registry both already use.

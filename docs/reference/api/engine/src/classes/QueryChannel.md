[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / QueryChannel

# Class: QueryChannel

Defined in: engine/src/bridge/QueryChannel.ts:389

The engine-side query/command channel. See the
module doc comment above for the transport-agnostic contract and the
no-live-instance-vs-empty-result distinction. One instance is meant to be
long-lived across scene reloads: call `attach()` again after every
`Game.loadScene()` (a new `Scene` means new entity ids and a new
`PhysicsSystem`), and `detach()` on `unloadScene()`/shutdown so in-flight
queries fail loudly with `"no-live-instance"` instead of resolving against
a torn-down scene.

## Constructors

### Constructor

> **new QueryChannel**(): `QueryChannel`

#### Returns

`QueryChannel`

## Accessors

### isLive

#### Get Signature

> **get** **isLive**(): `boolean`

Defined in: engine/src/bridge/QueryChannel.ts:458

##### Returns

`boolean`

## Methods

### attach()

> **attach**(`scene`, `physics?`, `options?`): `void`

Defined in: engine/src/bridge/QueryChannel.ts:440

Point this channel at a live `Scene` (and, if physics queries are
needed, its `PhysicsSystem`). `options.actors`/`options.navmesh` wire
in `ActorSystem`/navmesh queries the same way — all three are
independently optional, since a live scene can be attached with any
subset of them running (a scene with no navmesh loaded is normal, not
an error; see the module doc comment for the resulting error codes).

#### Parameters

##### scene

[`Scene`](Scene.md)

##### physics?

[`PhysicsSystem`](PhysicsSystem.md)

##### options?

[`QueryChannelAttachOptions`](../interfaces/QueryChannelAttachOptions.md)

#### Returns

`void`

***

### detach()

> **detach**(): `void`

Defined in: engine/src/bridge/QueryChannel.ts:454

Nothing is live any more — every query now answers `"no-live-instance"`.

#### Returns

`void`

***

### handle()

> **handle**(`query`): [`EngineQueryResult`](../type-aliases/EngineQueryResult.md)\<`unknown`\>

Defined in: engine/src/bridge/QueryChannel.ts:468

Answer one query synchronously. Transport-agnostic on purpose (see the
module doc comment) — a caller wiring this to a real transport reads
`query` off an `EngineQueryRequest`, calls this, and sends back an
`EngineQueryResponse` with the same `id`.

#### Parameters

##### query

[`EngineQuery`](../type-aliases/EngineQuery.md)

#### Returns

[`EngineQueryResult`](../type-aliases/EngineQueryResult.md)\<`unknown`\>

***

### registerComponents()

> **registerComponents**(...`defs`): `void`

Defined in: engine/src/bridge/QueryChannel.ts:405

Register component types this channel should read/list even before
`componentRegistry` has seen any live entity use them (e.g. right after
`attach()`, before the first `scene.spawn()`). Not required for
ordinary operation any more: `_resolveComponents()`/`_resolveComponent()`
also consult `componentRegistry.registeredComponents(scene.world)`
directly, which is what makes this channel work against a game whose
component set the caller never enumerated up front — the whole point
of ground rule 13's "IDE Inspector reads a real `ComponentRegistry`-
driven schema" item this channel now serves. Safe to call more than
once; later calls add to, rather than replace, the registered set.

#### Parameters

##### defs

...[`ComponentDef`](../interfaces/ComponentDef.md)\<[`SerializableRecord`](../type-aliases/SerializableRecord.md)\>[]

#### Returns

`void`

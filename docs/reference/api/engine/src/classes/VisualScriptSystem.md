[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / VisualScriptSystem

# Class: VisualScriptSystem

Defined in: engine/src/systems/VisualScriptSystem.ts:255

ECS-side driver for `VisualScriptState` entities. Takes a shared
`VariableStore`/`ActorSystem` once, at construction, matching
`SceneLifecycle`'s "one `VariableStore`/`ActorSystem` per scene, shared by
whatever reads it" convention (CLAUDE.md's "VNSystem and MapEventSystem
default to an isolated VariableStore" entry) — pass `ctx.variables`/
`ctx.actors` from a scene's `onLoad` to share state with the rest of the
game, or leave the defaults for an isolated instance.

Graphs are compiled once per distinct `graphId` and cached for the
system's lifetime; many entities sharing one `graphId` share one compiled
module, never duplicating the compiled function per entity.

## Constructors

### Constructor

> **new VisualScriptSystem**(`options?`): `VisualScriptSystem`

Defined in: engine/src/systems/VisualScriptSystem.ts:260

#### Parameters

##### options?

###### actorSystem?

[`ActorSystem`](ActorSystem.md)

###### variables?

[`VariableStore`](VariableStore.md)

#### Returns

`VisualScriptSystem`

## Accessors

### variables

#### Get Signature

> **get** **variables**(): [`VariableStore`](VariableStore.md)

Defined in: engine/src/systems/VisualScriptSystem.ts:315

##### Returns

[`VariableStore`](VariableStore.md)

## Methods

### fireEvent()

> **fireEvent**(`scene`, `eventType`): `void`

Defined in: engine/src/systems/VisualScriptSystem.ts:301

Fires `eventType` against every `VisualScriptState` entity's matching onEvent chain(s).

#### Parameters

##### scene

[`Scene`](Scene.md)

##### eventType

`string`

#### Returns

`void`

***

### invalidate()

> **invalidate**(`graphId`): `void`

Defined in: engine/src/systems/VisualScriptSystem.ts:281

Invalidates a cached compiled module, e.g. after re-registering `graphId` with new graph data.

#### Parameters

##### graphId

`string`

#### Returns

`void`

***

### update()

> **update**(`scene`): `void`

Defined in: engine/src/systems/VisualScriptSystem.ts:286

Runs every `VisualScriptState` entity's onUpdate chain(s) once.

#### Parameters

##### scene

[`Scene`](Scene.md)

#### Returns

`void`

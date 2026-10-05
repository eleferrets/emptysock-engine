[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / LoadSceneOptions

# Interface: LoadSceneOptions

Defined in: engine/src/Game.ts:160

## Properties

### carry?

> `optional` **carry?**: `false` \| [`TransferPolicy`](TransferPolicy.md)

Defined in: engine/src/Game.ts:167

Carry entities from the outgoing scene into this one. `false`/omitted
carries nothing (today's behaviour). The policy's `select` picks the
entities (see `persistentTransferPolicy`), captured after the outgoing
`onUnload` and restored by `SceneLifecycle.restoreCarried()`.

***

### headless?

> `optional` **headless?**: `boolean`

Defined in: engine/src/Game.ts:195

Force step 7 (render) to stay a no-op for this scene regardless of
whether a renderer is attached (the engine design notes's headless
testing harness uses this). Game code never sets this directly — see
`packages/engine/src/testing`. Belt-and-suspenders alongside "no
renderer attached": a headless game that somehow has a renderer
attached (e.g. a test that reuses a `Game` instance) still never
touches it.

***

### manageLifecycle?

> `optional` **manageLifecycle?**: `boolean`

Defined in: engine/src/Game.ts:183

the engine design notes's escape hatch. `false` hands back the raw
`ActorSystem`/`PhysicsSystem` instances for the caller to own (create,
destroy, share across scenes) instead of the engine doing it
automatically. Default `true`.

***

### physics?

> `optional` **physics?**: [`PhysicsSystemOptions`](PhysicsSystemOptions.md)

Defined in: engine/src/Game.ts:185

Physics gravity/config, forwarded to `PhysicsSystem.init()`.

***

### restart?

> `optional` **restart?**: `"room"` \| `"game"`

Defined in: engine/src/Game.ts:176

Marks this load as a restart. `"room"` discards the cached state of the
room being loaded (room restart); `"game"` discards every
cached room, skips caching the outgoing one and sets `Game.restarting`
during the unload so runtimes drop their own carry-over (`game_restart`:
persistent rooms are reset and persistent objects removed). Globals are
untouched.

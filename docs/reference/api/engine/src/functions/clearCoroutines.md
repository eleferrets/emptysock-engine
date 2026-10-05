[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / clearCoroutines

# Function: clearCoroutines()

> **clearCoroutines**(`world`, `eid`): `void`

Defined in: engine/src/Coroutines.ts:183

Clear every coroutine `eid` owns on `world`, aborting their controllers.
Called from `Scene.destroy()` for both the pooled-reset and real-destroy
paths, mirroring `clearPhysicsBody` — without this, a pooled entity's
bitECS id (deliberately never released back to bitECS's own recycling)
could inherit a coroutine still scheduled against the previous occupant.

## Parameters

### world

`World`

### eid

`number`

## Returns

`void`

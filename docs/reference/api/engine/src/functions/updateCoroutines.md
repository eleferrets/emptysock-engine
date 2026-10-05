[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / updateCoroutines

# Function: updateCoroutines()

> **updateCoroutines**(`world`, `dt`): `void`

Defined in: engine/src/Coroutines.ts:153

Step every running coroutine in `world` by `dt`. Called once per frame
from `Game.update()`'s per-scene frame step, after physics and before
`onUpdate` — the same "engine-driven state settles before user code runs"
ordering `runFrame()` already uses for actors/physics.

## Parameters

### world

`World`

### dt

`number`

## Returns

`void`

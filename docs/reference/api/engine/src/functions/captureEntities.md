[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / captureEntities

# Function: captureEntities()

> **captureEntities**(`scene`, `policy?`): [`SceneSnapshot`](../interfaces/SceneSnapshot.md)

Defined in: engine/src/SceneTransfer.ts:124

Snapshot every entity `policy.select` picks and clear its extras' side
tables. Components are shallow-copied (arrays one level) through each def's
optional `transfer` hook. The entities themselves are left in `scene`; the
caller is about to tear it down.

## Parameters

### scene

[`Scene`](../classes/Scene.md)

### policy?

[`TransferPolicy`](../interfaces/TransferPolicy.md) = `persistentTransferPolicy`

## Returns

[`SceneSnapshot`](../interfaces/SceneSnapshot.md)

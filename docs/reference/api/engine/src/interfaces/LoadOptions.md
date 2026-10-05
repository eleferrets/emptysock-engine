[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / LoadOptions

# Interface: LoadOptions

Defined in: engine/src/systems/SaveSystem.ts:170

## Properties

### mode?

> `readonly` `optional` **mode?**: `"replace"` \| `"append"`

Defined in: engine/src/systems/SaveSystem.ts:176

`"replace"` (default) destroys the scene's existing entities that carry a
save-aware component before loading, so a load yields the saved state
rather than saved plus current. `"append"` keeps them (the old behaviour).

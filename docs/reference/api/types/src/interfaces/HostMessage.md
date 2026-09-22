[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [types/src](../README.md) / HostMessage

# Interface: HostMessage

Defined in: [types/src/index.ts:228](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/types/src/index.ts#L228)

Minimal event envelope delivered to HostAdapter message listeners.
Mirrors the fields of DOM MessageEvent that the engine actually uses,
without importing any DOM type.

## Properties

### data

> `readonly` **data**: `unknown`

Defined in: [types/src/index.ts:229](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/types/src/index.ts#L229)

***

### origin

> `readonly` **origin**: `string`

Defined in: [types/src/index.ts:230](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/types/src/index.ts#L230)

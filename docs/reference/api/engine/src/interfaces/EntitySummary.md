[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / EntitySummary

# Interface: EntitySummary

Defined in: engine/src/bridge/QueryChannel.ts:247

## Properties

### active?

> `optional` **active?**: `boolean`

Defined in: engine/src/bridge/QueryChannel.ts:260

***

### components

> **components**: `string`[]

Defined in: engine/src/bridge/QueryChannel.ts:249

***

### entityId

> **entityId**: `number`

Defined in: engine/src/bridge/QueryChannel.ts:248

***

### name?

> `optional` **name?**: `string`

Defined in: engine/src/bridge/QueryChannel.ts:258

From the entity's optional `Meta` component (the release notes Track 0's
deferred IDEBridge/QueryChannel unification, resolved by
`ecs/components/Meta.ts`) — `undefined`/absent fields mean the entity
carries no `Meta` component at all, the common case for a purely
code-spawned entity. Never fabricated: a `name` present here always
came from a real `Meta.name` field, not a placeholder.

***

### rotation?

> `optional` **rotation?**: `number`

Defined in: engine/src/bridge/QueryChannel.ts:264

***

### tags?

> `optional` **tags?**: readonly `string`[]

Defined in: engine/src/bridge/QueryChannel.ts:259

***

### x?

> `optional` **x?**: `number`

Defined in: engine/src/bridge/QueryChannel.ts:262

From the entity's optional `Transform` component, when present.

***

### y?

> `optional` **y?**: `number`

Defined in: engine/src/bridge/QueryChannel.ts:263

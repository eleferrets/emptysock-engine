[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / SetComponentQuery

# Interface: SetComponentQuery

Defined in: engine/src/bridge/QueryChannel.ts:120

Merge `patch` into one component's live fields on one entity — the one
mutation this channel supports, alongside its otherwise read-only query
kinds. Exists for the IDE's live Inspector: editing a value while the
game is running has to reach the same live component data
`getComponent`/`listEntities` read, not a separate write path.

## Properties

### component

> **component**: `string`

Defined in: engine/src/bridge/QueryChannel.ts:123

***

### entityId

> **entityId**: `number`

Defined in: engine/src/bridge/QueryChannel.ts:122

***

### kind

> **kind**: `"setComponent"`

Defined in: engine/src/bridge/QueryChannel.ts:121

***

### patch

> **patch**: `Record`\<`string`, `unknown`\>

Defined in: engine/src/bridge/QueryChannel.ts:124

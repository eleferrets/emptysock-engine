[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / ComponentDef

# Interface: ComponentDef\<T\>

Defined in: engine/src/Component.ts:45

A registered component definition. the engine design notes: component
identity for bitECS's purposes is a plain object reference, which breaks
under hot-reload (a re-evaluated module produces a *new* reference for
what should be "the same" component). We fix that by keying identity on
`componentName` (a stable string the developer chooses once) rather than
on this object's own identity — see `ComponentRegistry`.

## Type Parameters

### T

`T` *extends* [`SerializableRecord`](../type-aliases/SerializableRecord.md) = [`SerializableRecord`](../type-aliases/SerializableRecord.md)

## Properties

### componentName

> `readonly` **componentName**: `string`

Defined in: engine/src/Component.ts:48

***

### createDefaults

> `readonly` **createDefaults**: () => `T`

Defined in: engine/src/Component.ts:50

Produces a fresh defaults object for a newly-added component instance.

#### Returns

`T`

***

### migrate?

> `readonly` `optional` **migrate?**: (`data`, `fromVersion`) => `Record`\<`string`, `unknown`\>

Defined in: engine/src/Component.ts:83

Optional hook run when a scene file entry was written at a different
`version` than this def's: receives the stored overrides and that older
version, returns the overrides in the current shape. Without it, the data
is applied as written and a warning is logged.

#### Parameters

##### data

`Record`\<`string`, `unknown`\>

##### fromVersion

`number`

#### Returns

`Record`\<`string`, `unknown`\>

***

### schema?

> `readonly` `optional` **schema?**: [`ComponentSchema`](../type-aliases/ComponentSchema.md)\<`T`\>

Defined in: engine/src/Component.ts:66

See `ComponentSchema`. `undefined` when `defineComponent` was called
without a `schema` option — the IDE Inspector treats that as "no
schema" and falls back to its raw per-field editor for this component,
not as an error.

***

### transfer?

> `readonly` `optional` **transfer?**: (`data`) => `Record`\<`string`, `unknown`\>

Defined in: engine/src/Component.ts:74

Optional hook run on a plain copy of this component's fields when its
entity is carried into another scene (`captureEntities`). Return the data
to keep: use it to reset engine-managed state that belongs to the old
world, e.g. `PhysicsBody` nulls its Rapier handles. Absent means the
fields are copied as-is.

#### Parameters

##### data

`Record`\<`string`, `unknown`\>

#### Returns

`Record`\<`string`, `unknown`\>

***

### version

> `readonly` **version**: `number`

Defined in: engine/src/Component.ts:59

Schema version for this component's shape, defaulting to `1` when not
given to `defineComponent`. `SaveSystem` (`ecs/systems/SaveSystem.ts`)
stamps every saved component instance with this number; on load, a
mismatch against the currently-registered def's version triggers that
component's registered `migrate()` hook, or a warn+drop of just that
component's data if none is registered.

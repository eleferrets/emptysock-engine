[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / PhysicsBody

# Variable: PhysicsBody

> `const` **PhysicsBody**: [`ComponentDef`](../interfaces/ComponentDef.md)\<\{ `bodyHandle`: `number` \| `null`; `colliderHandle`: `number` \| `null`; `density`: `number`; `friction`: `number`; `height`: `number`; `isSensor`: `boolean`; `position`: \{ `x`: `number`; `y`: `number`; \}; `radius`: `number`; `restitution`: `number`; `rotation`: `number`; `shape`: [`PhysicsBodyShape`](../type-aliases/PhysicsBodyShape.md); `type`: [`PhysicsBodyType`](../type-aliases/PhysicsBodyType.md); `velocity`: \{ `x`: `number`; `y`: `number`; \}; `width`: `number`; \}\>

Defined in: engine/src/components/PhysicsBody.ts:26

Plain-data shape of `PhysicsBody` — everything Rapier
needs, expressed in plain-language properties instead of raw Rapier
descriptors/handles. This is the object `defineComponent` stores in
bitECS's per-field arrays, so it must satisfy `SerializableRecord` — no
functions here. Callback properties (`onCollide` etc.) are *not* part of
this shape; see the module doc comment below for why, and `getPhysicsBody`
for how they're still exposed as plain assignable properties.

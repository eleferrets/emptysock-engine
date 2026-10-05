[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / Entity

# Class: Entity

Defined in: engine/src/Entity.ts:82

A lightweight, cheap-to-copy handle onto a bitECS entity (the engine design notes
§3). It carries no game state itself — state lives in the component
arrays `.get()` reaches into — only the bitECS world it belongs to and its
(already version-bit-encoded) entity id.

Because bitECS's versioned entity IDs are enabled by default (§23), a
handle to a destroyed entity never silently resolves onto whatever entity
happens to reuse its slot: `entityExists` compares the *whole* id,
version bits included, so a stale handle fails `.get()`/`.add()` loudly
instead of aliasing.

## Accessors

### isAlive

#### Get Signature

> **get** **isAlive**(): `boolean`

Defined in: engine/src/Entity.ts:124

`false` once this entity (or the slot it used to occupy) has been
destroyed and, for a stale handle, recycled — bitECS's versioned ids
make this comparison exact rather than "probably still valid".

##### Returns

`boolean`

***

### rawId

#### Get Signature

> **get** **rawId**(): `number`

Defined in: engine/src/Entity.ts:98

Raw numeric id, version bits stripped — mainly useful for logging.

##### Returns

`number`

## Methods

### add()

> **add**\<`T`\>(`def`, `overrides?`): `T`

Defined in: engine/src/Entity.ts:133

Add a component to this entity. Throws on a stale/destroyed handle
(mutating something that no longer exists is a bug, not a no-op) and
throws if the component is already present — "one shot" semantics.

#### Type Parameters

##### T

`T` *extends* [`SerializableRecord`](../type-aliases/SerializableRecord.md)

#### Parameters

##### def

[`ComponentDef`](../interfaces/ComponentDef.md)\<`T`\>

##### overrides?

`Partial`\<`T`\>

#### Returns

`T`

***

### get()

> **get**\<`T`\>(`def`): `T` \| `undefined`

Defined in: engine/src/Entity.ts:168

Returns the cached proxy for this (entity, component) pair, or
`undefined` if the entity is stale/destroyed or never had the
component. Per the engine design notes, the proxy is built once per pair
and reused for every subsequent call — never reallocated.

#### Type Parameters

##### T

`T` *extends* [`SerializableRecord`](../type-aliases/SerializableRecord.md)

#### Parameters

##### def

[`ComponentDef`](../interfaces/ComponentDef.md)\<`T`\>

#### Returns

`T` \| `undefined`

***

### has()

> **has**\<`T`\>(`def`): `boolean`

Defined in: engine/src/Entity.ts:156

`true` if this (living) entity carries the given component.

#### Type Parameters

##### T

`T` *extends* [`SerializableRecord`](../type-aliases/SerializableRecord.md)

#### Parameters

##### def

[`ComponentDef`](../interfaces/ComponentDef.md)\<`T`\>

#### Returns

`boolean`

***

### ref()

> **ref**(): [`EntityRef`](../type-aliases/EntityRef.md)

Defined in: engine/src/Entity.ts:112

Stable serialisable reference to this entity (assigns a per-scene id on
first call). Throws on a destroyed entity. See `EntityRef`.

#### Returns

[`EntityRef`](../type-aliases/EntityRef.md)

***

### remove()

> **remove**\<`T`\>(`def`): `void`

Defined in: engine/src/Entity.ts:187

Remove a component. No-op if the entity is stale or lacks it.

#### Type Parameters

##### T

`T` *extends* [`SerializableRecord`](../type-aliases/SerializableRecord.md)

#### Parameters

##### def

[`ComponentDef`](../interfaces/ComponentDef.md)\<`T`\>

#### Returns

`void`

***

### startCoroutine()

> **startCoroutine**(`factory`, `id?`): [`CoroutineHandle`](../interfaces/CoroutineHandle.md)

Defined in: engine/src/Entity.ts:210

Start a coroutine on this entity for work that spans multiple frames —
the required escape hatch for anything `onUpdate` can't do directly,
since `onUpdate` must not be `async` (CLAUDE.md's "onUpdate must not be
async"). The coroutine stops automatically the instant this entity is
no longer alive; see `ecs/Coroutines.ts` for the full cancellation
story (liveness check plus an opt-in `AbortSignal` for real async work).

```typescript
entity.startCoroutine(function* () {
  yield waitSeconds(1.0);
  doSomething();
});
```

#### Parameters

##### factory

[`CoroutineFactory`](../type-aliases/CoroutineFactory.md)

##### id?

`string`

#### Returns

[`CoroutineHandle`](../interfaces/CoroutineHandle.md)

***

### stopCoroutine()

> **stopCoroutine**(`id`): `void`

Defined in: engine/src/Entity.ts:215

Stop a coroutine by its id (the one returned from `startCoroutine`).

#### Parameters

##### id

`string`

#### Returns

`void`

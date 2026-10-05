[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / Scene

# Class: Scene

Defined in: engine/src/Scene.ts:73

## Constructors

### Constructor

> **new Scene**(): `Scene`

Defined in: engine/src/Scene.ts:89

#### Returns

`Scene`

## Accessors

### entityCount

#### Get Signature

> **get** **entityCount**(): `number`

Defined in: engine/src/Scene.ts:333

Number of entities currently alive in this scene.

##### Returns

`number`

## Methods

### childrenOf()

> **childrenOf**(`e`): [`Entity`](Entity.md)[]

Defined in: engine/src/Scene.ts:314

`ChildOf` children of `e`, in the order they were parented.

#### Parameters

##### e

[`Entity`](Entity.md)

#### Returns

[`Entity`](Entity.md)[]

***

### destroy()

> **destroy**(`entity`): `void`

Defined in: engine/src/Scene.ts:189

Destroy an entity. If it was spawned with `{ pool: true }` from a
prefab, this returns it to that prefab's pool instead of deallocating
it (§12.4) — its component data is stripped now and reset on reuse; the
caller sees the same call either way. Note one deliberate asymmetry: a
pooled entity's bitECS id is *not* released back to bitECS's own
recycling (`entity.isAlive` stays `true`) — that's what reserves the id
for this prefab's own pool instead of letting an unrelated `spawn()`
elsewhere claim it first. It has zero components after this call, so
`.get()` on any old handle simply returns `undefined` for everything,
same practical effect as "destroyed" for game code that isn't reaching
into the pool machinery itself. A non-pooled entity's handle (and any
other handle holding the same id) becomes stale immediately —
`entity.isAlive` reads `false` and `.get()`/`.add()` on it fail rather
than resolving onto whatever entity bitECS's id-recycling later hands
the freed slot to (§23).

#### Parameters

##### entity

[`Entity`](Entity.md)

#### Returns

`void`

***

### each()

> **each**\<`T`\>(...`args`): `void`

Defined in: engine/src/Scene.ts:344

Bulk-iteration power path (the engine design notes — `each`, not
`query`). Bypasses the `.get()` proxy layer entirely: components are
read straight off bitECS's arrays, and `entity` is only constructed
(cheaply — it's a handle, not an allocation of game state) for the
cases that still need it, e.g. `scene.destroy(entity)` inside the loop.

#### Type Parameters

##### T

`T` *extends* readonly [`ComponentDef`](../interfaces/ComponentDef.md)\<[`SerializableRecord`](../type-aliases/SerializableRecord.md)\>[]

#### Parameters

##### args

...\[`...T[]`, `EachCallback`\<`T`\>\]

#### Returns

`void`

***

### hasAll()

> **hasAll**(`entity`, ...`defs`): `boolean`

Defined in: engine/src/Scene.ts:373

`true` if `entity` (still alive) carries every listed component.

#### Parameters

##### entity

[`Entity`](Entity.md)

##### defs

...[`ComponentDef`](../interfaces/ComponentDef.md)\<[`SerializableRecord`](../type-aliases/SerializableRecord.md)\>[]

#### Returns

`boolean`

***

### idOf()

> **idOf**(`entity`): `number`

Defined in: engine/src/Scene.ts:244

Stable per-scene id for `entity`, assigned on first call (monotonic,
never reused within this scene). Throws for a destroyed entity or one
from another scene.

#### Parameters

##### entity

[`Entity`](Entity.md)

#### Returns

`number`

***

### onDestroyed()

> **onDestroyed**(`cb`): () => `void`

Defined in: engine/src/Scene.ts:277

Observe destruction of any entity in this scene (fires before teardown,
once per entity, children of a cascade included). `Game` forwards this to
the `entity:destroyed` signal. Returns an unsubscribe.

#### Parameters

##### cb

(`ref`) => `void`

#### Returns

() => `void`

***

### onParented()

> **onParented**(`cb`): () => `void`

Defined in: engine/src/Scene.ts:283

Observe `setParent` calls (`parent` is `NO_REF` when cleared). Returns an unsubscribe.

#### Parameters

##### cb

(`child`, `parent`) => `void`

#### Returns

() => `void`

***

### parentOf()

> **parentOf**(`e`): [`Entity`](Entity.md) \| `undefined`

Defined in: engine/src/Scene.ts:309

`ChildOf` parent of `e`, if any.

#### Parameters

##### e

[`Entity`](Entity.md)

#### Returns

[`Entity`](Entity.md) \| `undefined`

***

### refTo()

> **refTo**(`entity`): [`EntityRef`](../type-aliases/EntityRef.md)

Defined in: engine/src/Scene.ts:255

`EntityRef` for `entity` (see `idOf`).

#### Parameters

##### entity

[`Entity`](Entity.md)

#### Returns

[`EntityRef`](../type-aliases/EntityRef.md)

***

### relate()

> **relate**(`subject`, `relation`, `target`): `void`

Defined in: engine/src/Scene.ts:289

Add the edge `subject --relation--> target` (see `RelationDef`).

#### Parameters

##### subject

[`Entity`](Entity.md)

##### relation

[`RelationDef`](../interfaces/RelationDef.md)

##### target

[`Entity`](Entity.md)

#### Returns

`void`

***

### resolve()

> **resolve**(`ref`): [`Entity`](Entity.md) \| `undefined`

Defined in: engine/src/Scene.ts:265

The live entity `ref` points at, or `undefined` when it is `NO_REF`,
never existed, or was destroyed. A pooled-and-recycled entity counts as
destroyed: pooled destroy drops its id, so the ref does not alias the
entity's next occupant.

#### Parameters

##### ref

[`EntityRef`](../type-aliases/EntityRef.md) \| `null` \| `undefined`

#### Returns

[`Entity`](Entity.md) \| `undefined`

***

### setParent()

> **setParent**(`child`, `parent`): `void`

Defined in: engine/src/Scene.ts:322

Set (or with `undefined`, clear) `child`'s parent. Opt-in hierarchy:
destroying a parent destroys its children. Throws on a cycle.

#### Parameters

##### child

[`Entity`](Entity.md)

##### parent

[`Entity`](Entity.md) \| `undefined`

#### Returns

`void`

***

### spawn()

#### Call Signature

> **spawn**(`name?`): [`Entity`](Entity.md)

Defined in: engine/src/Scene.ts:100

Spawn a new, empty entity. Attach components with `entity.add(...)`.

##### Parameters

###### name?

`string`

##### Returns

[`Entity`](Entity.md)

#### Call Signature

> **spawn**\<`T`\>(`prefab`, `props?`, `options?`): [`Entity`](Entity.md)

Defined in: engine/src/Scene.ts:111

Spawn a `Prefab` as a unit onto one new entity
— every component the prefab declares, plus everything it `extends`
flattened in first. `props` is a flat, `Serializable` prop bag applied
on top of the prefab's own per-component defaults/overrides: a value
whose key matches a field name on one of the prefab's components
overrides that field (matching every component that happens to declare
a field with that name, e.g. `x`/`y` on any `Transform`-shaped
component in the prefab).

##### Type Parameters

###### T

`T` *extends* [`SerializableRecord`](../type-aliases/SerializableRecord.md)

##### Parameters

###### prefab

[`PrefabDef`](../interfaces/PrefabDef.md)\<`T`\>

###### props?

`Partial`\<`T`\>

###### options?

[`SpawnOptions`](../interfaces/SpawnOptions.md)

##### Returns

[`Entity`](Entity.md)

***

### subjectsOf()

> **subjectsOf**(`target`, `relation`): [`Entity`](Entity.md)[]

Defined in: engine/src/Scene.ts:304

Entities pointing at `target` through `relation`, in insertion order.

#### Parameters

##### target

[`Entity`](Entity.md)

##### relation

[`RelationDef`](../interfaces/RelationDef.md)

#### Returns

[`Entity`](Entity.md)[]

***

### targetsOf()

> **targetsOf**(`subject`, `relation`): [`Entity`](Entity.md)[]

Defined in: engine/src/Scene.ts:299

Entities `subject` points at through `relation`, in insertion order.

#### Parameters

##### subject

[`Entity`](Entity.md)

##### relation

[`RelationDef`](../interfaces/RelationDef.md)

#### Returns

[`Entity`](Entity.md)[]

***

### unrelate()

> **unrelate**(`subject`, `relation`, `target?`): `void`

Defined in: engine/src/Scene.ts:294

Remove one edge, or all of `subject`'s edges of `relation` when `target` is omitted.

#### Parameters

##### subject

[`Entity`](Entity.md)

##### relation

[`RelationDef`](../interfaces/RelationDef.md)

##### target?

[`Entity`](Entity.md)

#### Returns

`void`

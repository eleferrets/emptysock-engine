[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / definePrefab

# Function: definePrefab()

> **definePrefab**\<`T`\>(`prefabName`, `components`, `options?`): [`PrefabDef`](../interfaces/PrefabDef.md)\<`T`\>

Defined in: engine/src/Prefab.ts:58

Define a prefab. Nested prefabs (`extends`) are flattened at *spawn* time,
not here — `definePrefab` just records the template. Pass an explicit type
parameter to get typed `props` at hand-authored call sites too:
`definePrefab<{ x: number }>("Enemy", [...])`.

```ts
const Physical = definePrefab("Physical", [{ def: Transform }, { def: PhysicsBody }]);
const Enemy = definePrefab("Enemy", [{ def: Health, overrides: { max: 50 } }], { extends: [Physical] });
scene.spawn(Enemy, { x: 100 }); // Transform + PhysicsBody + Health, all on one entity
```

## Type Parameters

### T

`T` *extends* [`SerializableRecord`](../type-aliases/SerializableRecord.md) = [`SerializableRecord`](../type-aliases/SerializableRecord.md)

## Parameters

### prefabName

`string`

### components

readonly [`PrefabComponentEntry`](../interfaces/PrefabComponentEntry.md)\<[`SerializableRecord`](../type-aliases/SerializableRecord.md)\>[]

### options?

#### extends?

readonly [`PrefabDef`](../interfaces/PrefabDef.md)\<[`SerializableRecord`](../type-aliases/SerializableRecord.md)\>[]

## Returns

[`PrefabDef`](../interfaces/PrefabDef.md)\<`T`\>

[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / LayerSystem

# Class: LayerSystem

Defined in: [engine/src/systems/LayerSystem.ts:36](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/LayerSystem.ts#L36)

## Constructors

### Constructor

> **new LayerSystem**(): `LayerSystem`

Defined in: [engine/src/systems/LayerSystem.ts:41](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/LayerSystem.ts#L41)

#### Returns

`LayerSystem`

## Methods

### addEntity()

> **addEntity**(`entityId`, `layerName`, `depth?`): `void`

Defined in: [engine/src/systems/LayerSystem.ts:67](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/LayerSystem.ts#L67)

Assign an entity to a layer at a specific depth.
depth controls draw order within the layer: lower depth = drawn first (behind).
Default depth is 0. Unlike GMS2, this never changes implicitly.

#### Parameters

##### entityId

`number`

##### layerName

`string`

##### depth?

`number` = `0`

#### Returns

`void`

***

### defineLayer()

> **defineLayer**(`name`, `index`): `void`

Defined in: [engine/src/systems/LayerSystem.ts:53](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/LayerSystem.ts#L53)

Define or redefine a layer. Lower index = drawn first (behind).

#### Parameters

##### name

`string`

##### index

`number`

#### Returns

`void`

***

### destroy()

> **destroy**(): `void`

Defined in: [engine/src/systems/LayerSystem.ts:138](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/LayerSystem.ts#L138)

#### Returns

`void`

***

### getEntitiesOnLayer()

> **getEntitiesOnLayer**(`layerName`): `object`[]

Defined in: [engine/src/systems/LayerSystem.ts:124](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/LayerSystem.ts#L124)

Returns all entities on a given layer, sorted by depth ascending.

#### Parameters

##### layerName

`string`

#### Returns

`object`[]

***

### getEntityDepth()

> **getEntityDepth**(`entityId`): `number`

Defined in: [engine/src/systems/LayerSystem.ts:90](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/LayerSystem.ts#L90)

#### Parameters

##### entityId

`number`

#### Returns

`number`

***

### getEntityLayer()

> **getEntityLayer**(`entityId`): `string` \| `null`

Defined in: [engine/src/systems/LayerSystem.ts:86](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/LayerSystem.ts#L86)

#### Parameters

##### entityId

`number`

#### Returns

`string` \| `null`

***

### getLayerIndex()

> **getLayerIndex**(`name`): `number`

Defined in: [engine/src/systems/LayerSystem.ts:110](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/LayerSystem.ts#L110)

#### Parameters

##### name

`string`

#### Returns

`number`

***

### getLayersSorted()

> **getLayersSorted**(): [`LayerConfig`](../interfaces/LayerConfig.md)[]

Defined in: [engine/src/systems/LayerSystem.ts:134](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/LayerSystem.ts#L134)

All layer configs sorted by index ascending (render order).

#### Returns

[`LayerConfig`](../interfaces/LayerConfig.md)[]

***

### getSortKey()

> **getSortKey**(`entityId`): [`LayerSortKey`](../type-aliases/LayerSortKey.md)

Defined in: [engine/src/systems/LayerSystem.ts:103](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/LayerSystem.ts#L103)

Returns the sort key for a single entity.
Pass the result array into Array.sort for stable, explicit ordering:
  entities.sort((a, b) => {
    const [al, ad] = layers.getSortKey(a.id);
    const [bl, bd] = layers.getSortKey(b.id);
    return al !== bl ? al - bl : ad - bd;
  });

#### Parameters

##### entityId

`number`

#### Returns

[`LayerSortKey`](../type-aliases/LayerSortKey.md)

***

### isVisible()

> **isVisible**(`name`): `boolean`

Defined in: [engine/src/systems/LayerSystem.ts:119](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/LayerSystem.ts#L119)

#### Parameters

##### name

`string`

#### Returns

`boolean`

***

### removeEntity()

> **removeEntity**(`entityId`): `void`

Defined in: [engine/src/systems/LayerSystem.ts:76](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/LayerSystem.ts#L76)

#### Parameters

##### entityId

`number`

#### Returns

`void`

***

### setDepth()

> **setDepth**(`entityId`, `depth`): `void`

Defined in: [engine/src/systems/LayerSystem.ts:81](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/LayerSystem.ts#L81)

Update an entity's depth within its current layer without changing the layer.

#### Parameters

##### entityId

`number`

##### depth

`number`

#### Returns

`void`

***

### setVisible()

> **setVisible**(`name`, `visible`): `void`

Defined in: [engine/src/systems/LayerSystem.ts:114](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/LayerSystem.ts#L114)

#### Parameters

##### name

`string`

##### visible

`boolean`

#### Returns

`void`

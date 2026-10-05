[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / LayerSystem

# Class: LayerSystem

Defined in: engine/src/systems/LayerSystem.ts:36

## Constructors

### Constructor

> **new LayerSystem**(): `LayerSystem`

Defined in: engine/src/systems/LayerSystem.ts:43

#### Returns

`LayerSystem`

## Methods

### addEntity()

> **addEntity**(`entityId`, `layerName`, `depth?`): `void`

Defined in: engine/src/systems/LayerSystem.ts:69

Assign an entity to a layer at a specific depth.
depth controls draw order within the layer: lower depth = drawn first (behind).
Default depth is 0. This never changes implicitly.

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

Defined in: engine/src/systems/LayerSystem.ts:55

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

Defined in: engine/src/systems/LayerSystem.ts:175

#### Returns

`void`

***

### getEntitiesOnLayer()

> **getEntitiesOnLayer**(`layerName`): `object`[]

Defined in: engine/src/systems/LayerSystem.ts:158

Returns all entities on a given layer, sorted by depth ascending.

#### Parameters

##### layerName

`string`

#### Returns

`object`[]

***

### getEntityDepth()

> **getEntityDepth**(`entityId`): `number`

Defined in: engine/src/systems/LayerSystem.ts:94

#### Parameters

##### entityId

`number`

#### Returns

`number`

***

### getEntityLayer()

> **getEntityLayer**(`entityId`): `string` \| `null`

Defined in: engine/src/systems/LayerSystem.ts:90

#### Parameters

##### entityId

`number`

#### Returns

`string` \| `null`

***

### getLayerIndex()

> **getLayerIndex**(`name`): `number`

Defined in: engine/src/systems/LayerSystem.ts:114

#### Parameters

##### name

`string`

#### Returns

`number`

***

### getLayersSorted()

> **getLayersSorted**(): [`LayerConfig`](../interfaces/LayerConfig.md)[]

Defined in: engine/src/systems/LayerSystem.ts:171

All layer configs sorted by index ascending (render order).

#### Returns

[`LayerConfig`](../interfaces/LayerConfig.md)[]

***

### getOffset()

> **getOffset**(`name`): `object`

Defined in: engine/src/systems/LayerSystem.ts:153

A named layer's current render-position offset, `{ x: 0, y: 0 }` if
none was ever set — the same default an offset-free layer always had
before `layer_x`/`layer_y` existed.

#### Parameters

##### name

`string`

#### Returns

`object`

##### x

> **x**: `number`

##### y

> **y**: `number`

***

### getSortKey()

> **getSortKey**(`entityId`): [`LayerSortKey`](../type-aliases/LayerSortKey.md)

Defined in: engine/src/systems/LayerSystem.ts:107

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

### hasLayer()

> **hasLayer**(`name`): `boolean`

Defined in: engine/src/systems/LayerSystem.ts:130

True if a layer with this exact name has been defined — the real
backing for `layer_exists()` compat function
.

#### Parameters

##### name

`string`

#### Returns

`boolean`

***

### isVisible()

> **isVisible**(`name`): `boolean`

Defined in: engine/src/systems/LayerSystem.ts:123

#### Parameters

##### name

`string`

#### Returns

`boolean`

***

### removeEntity()

> **removeEntity**(`entityId`): `void`

Defined in: engine/src/systems/LayerSystem.ts:80

#### Parameters

##### entityId

`number`

#### Returns

`void`

***

### setDepth()

> **setDepth**(`entityId`, `depth`): `void`

Defined in: engine/src/systems/LayerSystem.ts:85

Update an entity's depth within its current layer without changing the layer.

#### Parameters

##### entityId

`number`

##### depth

`number`

#### Returns

`void`

***

### setOffset()

> **setOffset**(`name`, `x`, `y`): `void`

Defined in: engine/src/systems/LayerSystem.ts:144

Set a named layer's render-position offset — the real backing for
`layer_x`/`layer_y` compat functions,
typically used for manual parallax scrolling. A no-op for a layer that
hasn't been defined (`defineLayer()`/the built-in four) — matching this
codebase's established "no live layer/instance to even ask" honest
no-op convention (`QueryChannel`'s `no-live-instance`,
camera-follow's no-target no-op) rather than fabricating a new
layer just to hold an offset nobody will ever render.

#### Parameters

##### name

`string`

##### x

`number`

##### y

`number`

#### Returns

`void`

***

### setVisible()

> **setVisible**(`name`, `visible`): `void`

Defined in: engine/src/systems/LayerSystem.ts:118

#### Parameters

##### name

`string`

##### visible

`boolean`

#### Returns

`void`

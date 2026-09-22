[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / ObjectPool

# Class: ObjectPool\<T\>

Defined in: [engine/src/core/ObjectPool.ts:7](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/ObjectPool.ts#L7)

## Type Parameters

### T

`T` *extends* [`Poolable`](../interfaces/Poolable.md)

## Constructors

### Constructor

> **new ObjectPool**\<`T`\>(`factory`, `initialSize?`): `ObjectPool`\<`T`\>

Defined in: [engine/src/core/ObjectPool.ts:12](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/ObjectPool.ts#L12)

#### Parameters

##### factory

[`PoolFactory`](../type-aliases/PoolFactory.md)\<`T`\>

##### initialSize?

`number` = `0`

#### Returns

`ObjectPool`\<`T`\>

## Accessors

### available

#### Get Signature

> **get** **available**(): `number`

Defined in: [engine/src/core/ObjectPool.ts:34](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/ObjectPool.ts#L34)

##### Returns

`number`

***

### created

#### Get Signature

> **get** **created**(): `number`

Defined in: [engine/src/core/ObjectPool.ts:38](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/ObjectPool.ts#L38)

##### Returns

`number`

## Methods

### acquire()

> **acquire**(): `T`

Defined in: [engine/src/core/ObjectPool.ts:20](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/ObjectPool.ts#L20)

#### Returns

`T`

***

### clear()

> **clear**(): `void`

Defined in: [engine/src/core/ObjectPool.ts:42](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/ObjectPool.ts#L42)

#### Returns

`void`

***

### release()

> **release**(`obj`): `void`

Defined in: [engine/src/core/ObjectPool.ts:29](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/ObjectPool.ts#L29)

#### Parameters

##### obj

`T`

#### Returns

`void`

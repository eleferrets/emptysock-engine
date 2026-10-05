[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / VariableStore

# Class: VariableStore

Defined in: engine/src/systems/VariableStore.ts:34

## Constructors

### Constructor

> **new VariableStore**(): `VariableStore`

#### Returns

`VariableStore`

## Methods

### getSwitch()

> **getSwitch**(`index`): `boolean`

Defined in: engine/src/systems/VariableStore.ts:61

#### Parameters

##### index

`number`

#### Returns

`boolean`

***

### getSwitchName()

> **getSwitchName**(`index`): `string`

Defined in: engine/src/systems/VariableStore.ts:69

#### Parameters

##### index

`number`

#### Returns

`string`

***

### getVar()

> **getVar**(`index`): `number`

Defined in: engine/src/systems/VariableStore.ts:40

#### Parameters

##### index

`number`

#### Returns

`number`

***

### getVarName()

> **getVarName**(`index`): `string`

Defined in: engine/src/systems/VariableStore.ts:53

#### Parameters

##### index

`number`

#### Returns

`string`

***

### load()

> **load**(): `void`

Defined in: engine/src/systems/VariableStore.ts:81

#### Returns

`void`

***

### reset()

> **reset**(): `void`

Defined in: engine/src/systems/VariableStore.ts:94

#### Returns

`void`

***

### restore()

> **restore**(`data`): `void`

Defined in: engine/src/systems/VariableStore.ts:123

#### Parameters

##### data

`Partial`\<[`VariableStoreData`](../interfaces/VariableStoreData.md)\>

#### Returns

`void`

***

### save()

> **save**(): `void`

Defined in: engine/src/systems/VariableStore.ts:77

#### Returns

`void`

***

### setSwitch()

> **setSwitch**(`index`, `value`): `void`

Defined in: engine/src/systems/VariableStore.ts:65

#### Parameters

##### index

`number`

##### value

`boolean`

#### Returns

`void`

***

### setSwitchName()

> **setSwitchName**(`index`, `name`): `void`

Defined in: engine/src/systems/VariableStore.ts:73

#### Parameters

##### index

`number`

##### name

`string`

#### Returns

`void`

***

### setVar()

> **setVar**(`index`, `value`): `void`

Defined in: engine/src/systems/VariableStore.ts:49

Store a variable value. Values are stored as integers — fractional parts
are truncated. This matches RPG Maker's variable behaviour and is intentional.
Use separate fields in your save data if you need float precision.

#### Parameters

##### index

`number`

##### value

`number`

#### Returns

`void`

***

### setVarName()

> **setVarName**(`index`, `name`): `void`

Defined in: engine/src/systems/VariableStore.ts:57

#### Parameters

##### index

`number`

##### name

`string`

#### Returns

`void`

***

### snapshot()

> **snapshot**(): [`VariableStoreData`](../interfaces/VariableStoreData.md)

Defined in: engine/src/systems/VariableStore.ts:101

#### Returns

[`VariableStoreData`](../interfaces/VariableStoreData.md)

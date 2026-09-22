[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / VariableStore

# Class: VariableStore

Defined in: [engine/src/systems/VariableStore.ts:34](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/VariableStore.ts#L34)

## Constructors

### Constructor

> **new VariableStore**(): `VariableStore`

#### Returns

`VariableStore`

## Methods

### getSwitch()

> **getSwitch**(`index`): `boolean`

Defined in: [engine/src/systems/VariableStore.ts:61](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/VariableStore.ts#L61)

#### Parameters

##### index

`number`

#### Returns

`boolean`

***

### getSwitchName()

> **getSwitchName**(`index`): `string`

Defined in: [engine/src/systems/VariableStore.ts:69](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/VariableStore.ts#L69)

#### Parameters

##### index

`number`

#### Returns

`string`

***

### getVar()

> **getVar**(`index`): `number`

Defined in: [engine/src/systems/VariableStore.ts:40](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/VariableStore.ts#L40)

#### Parameters

##### index

`number`

#### Returns

`number`

***

### getVarName()

> **getVarName**(`index`): `string`

Defined in: [engine/src/systems/VariableStore.ts:53](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/VariableStore.ts#L53)

#### Parameters

##### index

`number`

#### Returns

`string`

***

### load()

> **load**(): `void`

Defined in: [engine/src/systems/VariableStore.ts:81](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/VariableStore.ts#L81)

#### Returns

`void`

***

### reset()

> **reset**(): `void`

Defined in: [engine/src/systems/VariableStore.ts:94](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/VariableStore.ts#L94)

#### Returns

`void`

***

### restore()

> **restore**(`data`): `void`

Defined in: [engine/src/systems/VariableStore.ts:123](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/VariableStore.ts#L123)

#### Parameters

##### data

`Partial`\<[`VariableStoreData`](../interfaces/VariableStoreData.md)\>

#### Returns

`void`

***

### save()

> **save**(): `void`

Defined in: [engine/src/systems/VariableStore.ts:77](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/VariableStore.ts#L77)

#### Returns

`void`

***

### setSwitch()

> **setSwitch**(`index`, `value`): `void`

Defined in: [engine/src/systems/VariableStore.ts:65](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/VariableStore.ts#L65)

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

Defined in: [engine/src/systems/VariableStore.ts:73](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/VariableStore.ts#L73)

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

Defined in: [engine/src/systems/VariableStore.ts:49](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/VariableStore.ts#L49)

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

Defined in: [engine/src/systems/VariableStore.ts:57](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/VariableStore.ts#L57)

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

Defined in: [engine/src/systems/VariableStore.ts:101](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/systems/VariableStore.ts#L101)

#### Returns

[`VariableStoreData`](../interfaces/VariableStoreData.md)

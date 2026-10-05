[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / KeyboardLayout

# Class: KeyboardLayout

Defined in: engine/src/systems/KeyboardLayout.ts:110

## Constructors

### Constructor

> **new KeyboardLayout**(): `KeyboardLayout`

#### Returns

`KeyboardLayout`

## Accessors

### version

#### Get Signature

> **get** **version**(): `number`

Defined in: engine/src/systems/KeyboardLayout.ts:122

Bumps on every table change (provider set, provider change, new or changed learned key).

##### Returns

`number`

## Methods

### charForCode()

> **charForCode**(`code`): `string` \| `undefined`

Defined in: engine/src/systems/KeyboardLayout.ts:197

Unshifted lowercase char typed by `code` (provider first, then learned), or undefined.

#### Parameters

##### code

`string`

#### Returns

`string` \| `undefined`

***

### codeForChar()

> **codeForChar**(`ch`): `string` \| `undefined`

Defined in: engine/src/systems/KeyboardLayout.ts:202

Physical code that types `ch` on the active layout, or undefined.

#### Parameters

##### ch

`string`

#### Returns

`string` \| `undefined`

***

### label()

> **label**(`code`): `string`

Defined in: engine/src/systems/KeyboardLayout.ts:207

UI label. Precedence: provider.labelForCode, provider char uppercased, learned char uppercased, default label.

#### Parameters

##### code

`string`

#### Returns

`string`

***

### learn()

> **learn**(`code`, `key`): `void`

Defined in: engine/src/systems/KeyboardLayout.ts:170

Learning fallback: record that physical `code` typed `key`. The caller
(`InputSystem`) has already dropped composing/dead/modified/shifted
events; this re-checks the parts that are cheap to check from data alone.

#### Parameters

##### code

`string`

##### key

`string`

#### Returns

`void`

***

### setProvider()

> **setProvider**(`p`): `void`

Defined in: engine/src/systems/KeyboardLayout.ts:127

Install (or with `null`, remove) the host provider. Its answers are snapshotted immediately and again on every `onChange`.

#### Parameters

##### p

[`KeyboardLayoutProvider`](../interfaces/KeyboardLayoutProvider.md) \| `null`

#### Returns

`void`

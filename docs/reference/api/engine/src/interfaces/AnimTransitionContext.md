[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / AnimTransitionContext

# Interface: AnimTransitionContext

Defined in: [engine/src/components/AnimatorController.ts:12](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/AnimatorController.ts#L12)

Read-only view of parameters/triggers handed to a transition's condition function.

## Methods

### getParam()

> **getParam**(`name`): [`AnimParamValue`](../type-aliases/AnimParamValue.md) \| `undefined`

Defined in: [engine/src/components/AnimatorController.ts:14](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/AnimatorController.ts#L14)

Current value of a parameter, or undefined if never set.

#### Parameters

##### name

`string`

#### Returns

[`AnimParamValue`](../type-aliases/AnimParamValue.md) \| `undefined`

***

### isTriggered()

> **isTriggered**(`name`): `boolean`

Defined in: [engine/src/components/AnimatorController.ts:16](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/AnimatorController.ts#L16)

Whether a trigger is currently armed (set since the last consumption).

#### Parameters

##### name

`string`

#### Returns

`boolean`

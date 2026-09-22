[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / AnimTransitionOptions

# Interface: AnimTransitionOptions

Defined in: [engine/src/components/AnimatorController.ts:19](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/AnimatorController.ts#L19)

## Properties

### condition

> **condition**: (`ctx`) => `boolean`

Defined in: [engine/src/components/AnimatorController.ts:23](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/AnimatorController.ts#L23)

Condition evaluated every update; transition fires when it returns true.

#### Parameters

##### ctx

[`AnimTransitionContext`](AnimTransitionContext.md)

#### Returns

`boolean`

***

### duration?

> `optional` **duration?**: `number`

Defined in: [engine/src/components/AnimatorController.ts:29](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/AnimatorController.ts#L29)

Cross-fade duration in seconds. 0 (default) is an instant cut.
During a non-zero duration both the outgoing and incoming clip are
reported by getActiveClips() with interpolated weights.

***

### to

> **to**: `string`

Defined in: [engine/src/components/AnimatorController.ts:21](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/AnimatorController.ts#L21)

Target state name to transition into.

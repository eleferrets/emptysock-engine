[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [vn/src](../README.md) / IVNListener

# Interface: IVNListener

Defined in: [vn/src/VNSystem.ts:59](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/vn/src/VNSystem.ts#L59)

## Properties

### onCGNode?

> `optional` **onCGNode?**: (`cgPath`) => `void`

Defined in: [vn/src/VNSystem.ts:64](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/vn/src/VNSystem.ts#L64)

#### Parameters

##### cgPath

`string`

#### Returns

`void`

***

### onChoice?

> `optional` **onChoice?**: (`options`) => `void`

Defined in: [vn/src/VNSystem.ts:61](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/vn/src/VNSystem.ts#L61)

#### Parameters

##### options

[`ChoiceOption`](ChoiceOption.md)[]

#### Returns

`void`

***

### onEnd?

> `optional` **onEnd?**: () => `void`

Defined in: [vn/src/VNSystem.ts:63](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/vn/src/VNSystem.ts#L63)

#### Returns

`void`

***

### onEvent?

> `optional` **onEvent?**: (`eventName`, ...`args`) => `void`

Defined in: [vn/src/VNSystem.ts:60](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/vn/src/VNSystem.ts#L60)

#### Parameters

##### eventName

`string`

##### args

...`unknown`[]

#### Returns

`void`

***

### onNode?

> `optional` **onNode?**: (`node`) => `void`

Defined in: [vn/src/VNSystem.ts:62](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/vn/src/VNSystem.ts#L62)

#### Parameters

##### node

[`DialogueNode`](../type-aliases/DialogueNode.md)

#### Returns

`void`

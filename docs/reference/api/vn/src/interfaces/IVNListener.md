[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [vn/src](../README.md) / IVNListener

# Interface: IVNListener

Defined in: vn/src/VNSystem.ts:58

## Properties

### onCGNode?

> `optional` **onCGNode?**: (`cgPath`) => `void`

Defined in: vn/src/VNSystem.ts:63

#### Parameters

##### cgPath

`string`

#### Returns

`void`

***

### onChoice?

> `optional` **onChoice?**: (`options`) => `void`

Defined in: vn/src/VNSystem.ts:60

#### Parameters

##### options

[`ChoiceOption`](ChoiceOption.md)[]

#### Returns

`void`

***

### onEnd?

> `optional` **onEnd?**: () => `void`

Defined in: vn/src/VNSystem.ts:62

#### Returns

`void`

***

### onEvent?

> `optional` **onEvent?**: (`eventName`, ...`args`) => `void`

Defined in: vn/src/VNSystem.ts:59

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

Defined in: vn/src/VNSystem.ts:61

#### Parameters

##### node

[`DialogueNode`](../type-aliases/DialogueNode.md)

#### Returns

`void`

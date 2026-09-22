[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / RigidJoint

# Class: RigidJoint

Defined in: [engine/src/components/RigidJoint.ts:35](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/RigidJoint.ts#L35)

## Extends

- [`Component`](Component.md)

## Constructors

### Constructor

> **new RigidJoint**(`options?`): `RigidJoint`

Defined in: [engine/src/components/RigidJoint.ts:50](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/RigidJoint.ts#L50)

#### Parameters

##### options?

###### bodyBEntityId?

`number`

###### jointType?

[`JointType`](../type-aliases/JointType.md)

###### prismatic?

[`PrismaticOptions`](../interfaces/PrismaticOptions.md)

###### revolute?

[`RevoluteOptions`](../interfaces/RevoluteOptions.md)

###### spring?

[`SpringOptions`](../interfaces/SpringOptions.md)

#### Returns

`RigidJoint`

#### Overrides

[`Component`](Component.md).[`constructor`](Component.md#constructor)

## Properties

### bodyBEntityId

> **bodyBEntityId**: `number` \| `null`

Defined in: [engine/src/components/RigidJoint.ts:41](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/RigidJoint.ts#L41)

ID of the Entity that holds the second PhysicsBody in this joint.

***

### enabled

> **enabled**: `boolean` = `true`

Defined in: [engine/src/core/Component.ts:23](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Component.ts#L23)

#### Inherited from

[`Component`](Component.md).[`enabled`](Component.md#enabled)

***

### jointHandle

> **jointHandle**: `number` \| `null` = `null`

Defined in: [engine/src/components/RigidJoint.ts:48](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/RigidJoint.ts#L48)

Runtime Rapier joint handle — set by PhysicsSystem.

***

### jointType

> `readonly` **jointType**: [`JointType`](../type-aliases/JointType.md)

Defined in: [engine/src/components/RigidJoint.ts:39](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/RigidJoint.ts#L39)

***

### prismatic

> `readonly` **prismatic**: [`PrismaticOptions`](../interfaces/PrismaticOptions.md)

Defined in: [engine/src/components/RigidJoint.ts:44](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/RigidJoint.ts#L44)

***

### revolute

> `readonly` **revolute**: [`RevoluteOptions`](../interfaces/RevoluteOptions.md)

Defined in: [engine/src/components/RigidJoint.ts:43](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/RigidJoint.ts#L43)

***

### spring

> `readonly` **spring**: [`SpringOptions`](../interfaces/SpringOptions.md)

Defined in: [engine/src/components/RigidJoint.ts:45](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/RigidJoint.ts#L45)

***

### type

> `readonly` **type**: `string`

Defined in: [engine/src/core/Component.ts:22](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Component.ts#L22)

#### Inherited from

[`Component`](Component.md).[`type`](Component.md#type)

***

### TYPE

> `readonly` `static` **TYPE**: [`ComponentType`](../type-aliases/ComponentType.md)\<`RigidJoint`\>

Defined in: [engine/src/components/RigidJoint.ts:36](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/RigidJoint.ts#L36)

## Methods

### onAttach()?

> `optional` **onAttach**(): `void`

Defined in: [engine/src/core/Component.ts:30](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Component.ts#L30)

Called once when component is first attached to an entity

#### Returns

`void`

#### Inherited from

[`Component`](Component.md).[`onAttach`](Component.md#onattach)

***

### onDetach()?

> `optional` **onDetach**(): `void`

Defined in: [engine/src/core/Component.ts:33](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Component.ts#L33)

Called once when component is detached from an entity

#### Returns

`void`

#### Inherited from

[`Component`](Component.md).[`onDetach`](Component.md#ondetach)

***

### serialize()

> **serialize**(): `Record`\<`string`, `unknown`\>

Defined in: [engine/src/components/RigidJoint.ts:67](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/components/RigidJoint.ts#L67)

Serialize component data for saving

#### Returns

`Record`\<`string`, `unknown`\>

#### Overrides

[`Component`](Component.md).[`serialize`](Component.md#serialize)

***

### update()?

> `optional` **update**(`_deltaTime`): `void`

Defined in: [engine/src/core/Component.ts:36](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Component.ts#L36)

Called each frame during the update pass

#### Parameters

##### \_deltaTime

`number`

#### Returns

`void`

#### Inherited from

[`Component`](Component.md).[`update`](Component.md#update)

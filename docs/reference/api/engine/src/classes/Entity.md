[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / Entity

# Class: Entity

Defined in: [engine/src/core/Entity.ts:30](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L30)

## Constructors

### Constructor

> **new Entity**(`name?`): `Entity`

Defined in: [engine/src/core/Entity.ts:64](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L64)

#### Parameters

##### name?

`string` = `"Entity"`

#### Returns

`Entity`

## Properties

### active

> **active**: `boolean` = `true`

Defined in: [engine/src/core/Entity.ts:33](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L33)

***

### id

> `readonly` **id**: `number`

Defined in: [engine/src/core/Entity.ts:31](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L31)

***

### name

> **name**: `string`

Defined in: [engine/src/core/Entity.ts:32](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L32)

***

### position

> **position**: [`Vec2`](../interfaces/Vec2.md)

Defined in: [engine/src/core/Entity.ts:36](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L36)

World-space position. Mutate directly or via `setPosition()` / `translate()`.

***

### rotation

> **rotation**: `number` = `0`

Defined in: [engine/src/core/Entity.ts:38](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L38)

Rotation in radians.

***

### scale

> **scale**: [`Vec2`](../interfaces/Vec2.md)

Defined in: [engine/src/core/Entity.ts:40](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L40)

Non-uniform scale. Default 1×1.

## Accessors

### children

#### Get Signature

> **get** **children**(): readonly `Entity`[]

Defined in: [engine/src/core/Entity.ts:187](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L187)

##### Returns

readonly `Entity`[]

***

### isDestroyed

#### Get Signature

> **get** **isDestroyed**(): `boolean`

Defined in: [engine/src/core/Entity.ts:254](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L254)

##### Returns

`boolean`

***

### parent

#### Get Signature

> **get** **parent**(): `Entity` \| `null`

Defined in: [engine/src/core/Entity.ts:183](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L183)

##### Returns

`Entity` \| `null`

***

### tags

#### Get Signature

> **get** **tags**(): `ReadonlySet`\<`string`\>

Defined in: [engine/src/core/Entity.ts:44](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L44)

##### Returns

`ReadonlySet`\<`string`\>

## Methods

### addBehavior()

> **addBehavior**(`behavior`): `this`

Defined in: [engine/src/core/Entity.ts:166](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L166)

Attach a behavior to this entity. `onAttach()` is called immediately.
The behavior's `update()` is called every frame via `entity.update()`.

#### Parameters

##### behavior

`BehaviorLike`

#### Returns

`this`

#### Example

```typescript
const move = new EightDirBehavior(input, 200)
player.addBehavior(move)
```

***

### addChild()

> **addChild**(`child`): `void`

Defined in: [engine/src/core/Entity.ts:191](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L191)

#### Parameters

##### child

`Entity`

#### Returns

`void`

***

### addComponent()

> **addComponent**\<`T`\>(`component`): `T`

Defined in: [engine/src/core/Entity.ts:112](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L112)

#### Type Parameters

##### T

`T` *extends* [`Component`](Component.md)

#### Parameters

##### component

`T`

#### Returns

`T`

***

### addTag()

> **addTag**(`tag`): `this`

Defined in: [engine/src/core/Entity.ts:400](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L400)

#### Parameters

##### tag

`string`

#### Returns

`this`

***

### angleTo()

> **angleTo**(`other`): `number`

Defined in: [engine/src/core/Entity.ts:104](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L104)

Angle in radians from this entity toward `other`.

#### Parameters

##### other

`Entity` \| [`Vec2`](../interfaces/Vec2.md)

#### Returns

`number`

***

### destroy()

> **destroy**(): `void`

Defined in: [engine/src/core/Entity.ts:217](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L217)

Mark this entity as destroyed. Detaches from parent, calls `onDetach` on
all components, stops all coroutines, and sets `active = false`. The Scene
removes destroyed entities on the next `removeEntity()` call — entities
call this themselves; the scene listens for the `destroy` event to clean up.

#### Returns

`void`

***

### distanceTo()

> **distanceTo**(`other`): `number`

Defined in: [engine/src/core/Entity.ts:95](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L95)

Euclidean distance to `other`.

#### Parameters

##### other

`Entity` \| [`Vec2`](../interfaces/Vec2.md)

#### Returns

`number`

***

### emit()

> **emit**(`event`, ...`args`): `void`

Defined in: [engine/src/core/Entity.ts:286](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L286)

#### Parameters

##### event

`string`

##### args

...`unknown`[]

#### Returns

`void`

***

### getComponent()

> **getComponent**\<`T`\>(`type`): `T` \| `undefined`

Defined in: [engine/src/core/Entity.ts:123](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L123)

#### Type Parameters

##### T

`T` *extends* [`Component`](Component.md)

#### Parameters

##### type

`string` \| [`ComponentType`](../type-aliases/ComponentType.md)\<`T`\>

#### Returns

`T` \| `undefined`

***

### getComponents()

> **getComponents**(): `ReadonlyMap`\<`string`, [`Component`](Component.md)\>

Defined in: [engine/src/core/Entity.ts:150](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L150)

#### Returns

`ReadonlyMap`\<`string`, [`Component`](Component.md)\>

***

### hasComponent()

> **hasComponent**(`type`): `boolean`

Defined in: [engine/src/core/Entity.ts:139](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L139)

#### Parameters

##### type

`string` \| [`ComponentType`](../type-aliases/ComponentType.md)

#### Returns

`boolean`

***

### hasTag()

> **hasTag**(`tag`): `boolean`

Defined in: [engine/src/core/Entity.ts:396](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L396)

#### Parameters

##### tag

`string`

#### Returns

`boolean`

***

### off()

> **off**(`event`, `handler`): `this`

Defined in: [engine/src/core/Entity.ts:280](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L280)

#### Parameters

##### event

`string`

##### handler

`EventHandler`

#### Returns

`this`

***

### on()

> **on**(`event`, `handler`): `this`

Defined in: [engine/src/core/Entity.ts:260](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L260)

#### Parameters

##### event

`string`

##### handler

`EventHandler`

#### Returns

`this`

***

### once()

> **once**(`event`, `handler`): `this`

Defined in: [engine/src/core/Entity.ts:270](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L270)

#### Parameters

##### event

`string`

##### handler

`EventHandler`

#### Returns

`this`

***

### onCollisionEnter()

> **onCollisionEnter**(`handler`): () => `void`

Defined in: [engine/src/core/Entity.ts:305](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L305)

Register a callback for when this entity begins a physics collision.

#### Parameters

##### handler

(`other`, `contact`) => `void`

#### Returns

() => `void`

***

### onCollisionExit()

> **onCollisionExit**(`handler`): () => `void`

Defined in: [engine/src/core/Entity.ts:315](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L315)

Register a callback for when this entity ends a physics collision.

#### Parameters

##### handler

(`other`, `contact`) => `void`

#### Returns

() => `void`

***

### onSensorEnter()

> **onSensorEnter**(`handler`): () => `void`

Defined in: [engine/src/core/Entity.ts:325](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L325)

Register a callback for when another entity enters this sensor.

#### Parameters

##### handler

(`other`) => `void`

#### Returns

() => `void`

***

### onSensorExit()

> **onSensorExit**(`handler`): () => `void`

Defined in: [engine/src/core/Entity.ts:333](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L333)

Register a callback for when another entity exits this sensor.

#### Parameters

##### handler

(`other`) => `void`

#### Returns

() => `void`

***

### removeBehavior()

> **removeBehavior**(`behavior`): `boolean`

Defined in: [engine/src/core/Entity.ts:173](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L173)

Remove a previously attached behavior. Calls `onDetach()`.

#### Parameters

##### behavior

`BehaviorLike`

#### Returns

`boolean`

***

### removeComponent()

> **removeComponent**(`type`): `boolean`

Defined in: [engine/src/core/Entity.ts:143](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L143)

#### Parameters

##### type

`string` \| [`ComponentType`](../type-aliases/ComponentType.md)

#### Returns

`boolean`

***

### removeFromParent()

> **removeFromParent**(): `void`

Defined in: [engine/src/core/Entity.ts:205](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L205)

#### Returns

`void`

***

### removeTag()

> **removeTag**(`tag`): `this`

Defined in: [engine/src/core/Entity.ts:405](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L405)

#### Parameters

##### tag

`string`

#### Returns

`this`

***

### requireComponent()

> **requireComponent**\<`T`\>(`type`): `T`

Defined in: [engine/src/core/Entity.ts:129](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L129)

#### Type Parameters

##### T

`T` *extends* [`Component`](Component.md)

#### Parameters

##### type

`string` \| [`ComponentType`](../type-aliases/ComponentType.md)\<`T`\>

#### Returns

`T`

***

### rotateTo()

> **rotateTo**(`target`): `this`

Defined in: [engine/src/core/Entity.ts:86](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L86)

Set rotation to face `target`, returning `this` for chaining.

#### Parameters

##### target

[`Vec2`](../interfaces/Vec2.md)

#### Returns

`this`

***

### setPosition()

> **setPosition**(`x`, `y`): `this`

Defined in: [engine/src/core/Entity.ts:72](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L72)

Set position by component, returning `this` for chaining.

#### Parameters

##### x

`number`

##### y

`number`

#### Returns

`this`

***

### startCoroutine()

> **startCoroutine**(`gen`, `id?`): [`CoroutineHandle`](../interfaces/CoroutineHandle.md)

Defined in: [engine/src/core/Entity.ts:354](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L354)

Start a coroutine on this entity. Returns a handle with a `cancel()` method.
The coroutine is stopped automatically when the entity is destroyed.

#### Parameters

##### gen

[`CoroutineGen`](../type-aliases/CoroutineGen.md) \| (() => [`CoroutineGen`](../type-aliases/CoroutineGen.md))

##### id?

`string`

#### Returns

[`CoroutineHandle`](../interfaces/CoroutineHandle.md)

#### Example

```typescript
entity.startCoroutine(function* () {
  yield waitSeconds(1.0)
  doSomething()
})
```

***

### stopCoroutine()

> **stopCoroutine**(`id`): `void`

Defined in: [engine/src/core/Entity.ts:372](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L372)

Stop a coroutine by its ID (the one returned from `startCoroutine`).

#### Parameters

##### id

`string`

#### Returns

`void`

***

### translate()

> **translate**(`dx`, `dy`): `this`

Defined in: [engine/src/core/Entity.ts:79](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L79)

Translate by a delta, returning `this` for chaining.

#### Parameters

##### dx

`number`

##### dy

`number`

#### Returns

`this`

***

### update()

> **update**(`deltaTime`): `void`

Defined in: [engine/src/core/Entity.ts:378](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/core/Entity.ts#L378)

#### Parameters

##### deltaTime

`number`

#### Returns

`void`

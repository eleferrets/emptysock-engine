[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / Sprite

# Class: Sprite

Defined in: [engine/src/components/Sprite.ts:14](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/Sprite.ts#L14)

Sprite — a visible, textured entity. Attaching Sprite alongside Transform
is all a game needs to appear on screen: `RenderPipeline.renderFrame()`
finds every Transform+Sprite pair each frame, keeps a PixiJS sprite in
sync with it, and places it on `layer`/`depth` automatically. There is no
separate manual step to register the entity with the renderer.

## Extends

- [`Component`](Component.md)

## Constructors

### Constructor

> **new Sprite**(`options?`): `Sprite`

Defined in: [engine/src/components/Sprite.ts:28](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/Sprite.ts#L28)

#### Parameters

##### options?

###### alpha?

`number`

###### anchorX?

`number`

###### anchorY?

`number`

###### depth?

`number`

###### layer?

`string`

###### texturePath?

`string`

###### tint?

`number`

###### visible?

`boolean`

#### Returns

`Sprite`

#### Overrides

[`Component`](Component.md).[`constructor`](Component.md#constructor)

## Properties

### alpha

> **alpha**: `number`

Defined in: [engine/src/components/Sprite.ts:19](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/Sprite.ts#L19)

***

### anchorX

> **anchorX**: `number`

Defined in: [engine/src/components/Sprite.ts:20](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/Sprite.ts#L20)

***

### anchorY

> **anchorY**: `number`

Defined in: [engine/src/components/Sprite.ts:21](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/Sprite.ts#L21)

***

### depth

> **depth**: `number`

Defined in: [engine/src/components/Sprite.ts:25](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/Sprite.ts#L25)

Draw order within `layer` — lower draws first (behind). Defaults to 0.

***

### enabled

> **enabled**: `boolean` = `true`

Defined in: [engine/src/core/Component.ts:23](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Component.ts#L23)

#### Inherited from

[`Component`](Component.md).[`enabled`](Component.md#enabled)

***

### layer

> **layer**: `string`

Defined in: [engine/src/components/Sprite.ts:23](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/Sprite.ts#L23)

Named render layer (see LayerSystem). Defaults to `"default"`.

***

### texturePath

> **texturePath**: `string`

Defined in: [engine/src/components/Sprite.ts:17](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/Sprite.ts#L17)

***

### tint

> **tint**: `number`

Defined in: [engine/src/components/Sprite.ts:18](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/Sprite.ts#L18)

***

### type

> `readonly` **type**: `string`

Defined in: [engine/src/core/Component.ts:22](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Component.ts#L22)

#### Inherited from

[`Component`](Component.md).[`type`](Component.md#type)

***

### visible

> **visible**: `boolean`

Defined in: [engine/src/components/Sprite.ts:26](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/Sprite.ts#L26)

***

### TYPE

> `readonly` `static` **TYPE**: [`ComponentType`](../type-aliases/ComponentType.md)\<`Sprite`\>

Defined in: [engine/src/components/Sprite.ts:15](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/Sprite.ts#L15)

## Methods

### onAttach()?

> `optional` **onAttach**(): `void`

Defined in: [engine/src/core/Component.ts:30](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Component.ts#L30)

Called once when component is first attached to an entity

#### Returns

`void`

#### Inherited from

[`Component`](Component.md).[`onAttach`](Component.md#onattach)

***

### onDetach()?

> `optional` **onDetach**(): `void`

Defined in: [engine/src/core/Component.ts:33](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Component.ts#L33)

Called once when component is detached from an entity

#### Returns

`void`

#### Inherited from

[`Component`](Component.md).[`onDetach`](Component.md#ondetach)

***

### serialize()

> **serialize**(): `Record`\<`string`, `unknown`\>

Defined in: [engine/src/components/Sprite.ts:51](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/components/Sprite.ts#L51)

Serialize component data for saving

#### Returns

`Record`\<`string`, `unknown`\>

#### Overrides

[`Component`](Component.md).[`serialize`](Component.md#serialize)

***

### update()?

> `optional` **update**(`_deltaTime`): `void`

Defined in: [engine/src/core/Component.ts:36](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/core/Component.ts#L36)

Called each frame during the update pass

#### Parameters

##### \_deltaTime

`number`

#### Returns

`void`

#### Inherited from

[`Component`](Component.md).[`update`](Component.md#update)

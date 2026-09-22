[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / ButtonWidget

# Class: ButtonWidget

Defined in: [engine/src/ui/widgets/button.ts:21](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/button.ts#L21)

## Extends

- [`Widget`](Widget.md)

## Constructors

### Constructor

> **new ButtonWidget**(`opts?`): `ButtonWidget`

Defined in: [engine/src/ui/widgets/button.ts:36](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/button.ts#L36)

#### Parameters

##### opts?

[`ButtonWidgetOpts`](../interfaces/ButtonWidgetOpts.md) = `{}`

#### Returns

`ButtonWidget`

#### Overrides

[`Widget`](Widget.md).[`constructor`](Widget.md#constructor)

## Properties

### \_anim

> **\_anim**: `ActiveAnim` \| `null` = `null`

Defined in: [engine/src/ui/widgets/base.ts:135](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/base.ts#L135)

#### Inherited from

[`Widget`](Widget.md).[`_anim`](Widget.md#_anim)

***

### \_animDx

> **\_animDx**: `number` = `0`

Defined in: [engine/src/ui/widgets/base.ts:136](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/base.ts#L136)

#### Inherited from

[`Widget`](Widget.md).[`_animDx`](Widget.md#_animdx)

***

### \_animDy

> **\_animDy**: `number` = `0`

Defined in: [engine/src/ui/widgets/base.ts:137](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/base.ts#L137)

#### Inherited from

[`Widget`](Widget.md).[`_animDy`](Widget.md#_animdy)

***

### \_hovered

> **\_hovered**: `boolean` = `false`

Defined in: [engine/src/ui/widgets/base.ts:140](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/base.ts#L140)

#### Inherited from

[`Widget`](Widget.md).[`_hovered`](Widget.md#_hovered)

***

### \_scaleX

> **\_scaleX**: `number` = `1`

Defined in: [engine/src/ui/widgets/base.ts:138](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/base.ts#L138)

#### Inherited from

[`Widget`](Widget.md).[`_scaleX`](Widget.md#_scalex)

***

### \_scaleY

> **\_scaleY**: `number` = `1`

Defined in: [engine/src/ui/widgets/base.ts:139](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/base.ts#L139)

#### Inherited from

[`Widget`](Widget.md).[`_scaleY`](Widget.md#_scaley)

***

### alpha

> **alpha**: `number`

Defined in: [engine/src/ui/widgets/base.ts:132](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/base.ts#L132)

#### Inherited from

[`Widget`](Widget.md).[`alpha`](Widget.md#alpha)

***

### anchor

> **anchor**: [`WidgetAnchor`](../type-aliases/WidgetAnchor.md)

Defined in: [engine/src/ui/widgets/base.ts:130](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/base.ts#L130)

#### Inherited from

[`Widget`](Widget.md).[`anchor`](Widget.md#anchor)

***

### animateOnHover

> **animateOnHover**: `boolean`

Defined in: [engine/src/ui/widgets/button.ts:32](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/button.ts#L32)

***

### background

> **background**: `string`

Defined in: [engine/src/ui/widgets/button.ts:25](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/button.ts#L25)

***

### borderRadius

> **borderRadius**: `number`

Defined in: [engine/src/ui/widgets/button.ts:28](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/button.ts#L28)

***

### children

> `readonly` **children**: [`Widget`](Widget.md)[] = `[]`

Defined in: [engine/src/ui/widgets/base.ts:133](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/base.ts#L133)

#### Inherited from

[`Widget`](Widget.md).[`children`](Widget.md#children)

***

### color

> **color**: `string`

Defined in: [engine/src/ui/widgets/button.ts:24](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/button.ts#L24)

***

### disabled

> **disabled**: `boolean`

Defined in: [engine/src/ui/widgets/button.ts:31](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/button.ts#L31)

***

### font

> **font**: `string`

Defined in: [engine/src/ui/widgets/button.ts:30](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/button.ts#L30)

***

### fontSize

> **fontSize**: `number`

Defined in: [engine/src/ui/widgets/button.ts:29](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/button.ts#L29)

***

### height

> **height**: `number`

Defined in: [engine/src/ui/widgets/base.ts:129](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/base.ts#L129)

#### Inherited from

[`Widget`](Widget.md).[`height`](Widget.md#height)

***

### hoverBackground

> **hoverBackground**: `string`

Defined in: [engine/src/ui/widgets/button.ts:26](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/button.ts#L26)

***

### icon

> **icon**: `string` \| `undefined`

Defined in: [engine/src/ui/widgets/button.ts:23](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/button.ts#L23)

***

### id

> `readonly` **id**: `number`

Defined in: [engine/src/ui/widgets/base.ts:125](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/base.ts#L125)

#### Inherited from

[`Widget`](Widget.md).[`id`](Widget.md#id)

***

### label

> **label**: `string`

Defined in: [engine/src/ui/widgets/button.ts:22](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/button.ts#L22)

***

### pressedBackground

> **pressedBackground**: `string`

Defined in: [engine/src/ui/widgets/button.ts:27](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/button.ts#L27)

***

### uiScale

> **uiScale**: `number` = `1`

Defined in: [engine/src/ui/widgets/base.ts:148](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/base.ts#L148)

Uniform display scale applied on top of `width`/`height`/`x`/`y` when
resolving screen-space position and hit-testing, intended to be driven
by the canvas-to-design-resolution ratio (e.g. from a future
ViewportSystem, or `UISystem.setScale`). Defaults to 1 — unscaled.

#### Inherited from

[`Widget`](Widget.md).[`uiScale`](Widget.md#uiscale)

***

### visible

> **visible**: `boolean`

Defined in: [engine/src/ui/widgets/base.ts:131](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/base.ts#L131)

#### Inherited from

[`Widget`](Widget.md).[`visible`](Widget.md#visible)

***

### width

> **width**: `number`

Defined in: [engine/src/ui/widgets/base.ts:128](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/base.ts#L128)

#### Inherited from

[`Widget`](Widget.md).[`width`](Widget.md#width)

***

### x

> **x**: `number`

Defined in: [engine/src/ui/widgets/base.ts:126](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/base.ts#L126)

#### Inherited from

[`Widget`](Widget.md).[`x`](Widget.md#x)

***

### y

> **y**: `number`

Defined in: [engine/src/ui/widgets/base.ts:127](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/base.ts#L127)

#### Inherited from

[`Widget`](Widget.md).[`y`](Widget.md#y)

## Accessors

### state

#### Get Signature

> **get** **state**(): [`ButtonState`](../type-aliases/ButtonState.md)

Defined in: [engine/src/ui/widgets/button.ts:56](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/button.ts#L56)

##### Returns

[`ButtonState`](../type-aliases/ButtonState.md)

## Methods

### \_emit()

> **\_emit**(`event`, `value?`): `void`

Defined in: [engine/src/ui/widgets/base.ts:183](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/base.ts#L183)

#### Parameters

##### event

[`WidgetEvent`](../type-aliases/WidgetEvent.md)

##### value?

`unknown`

#### Returns

`void`

#### Inherited from

[`Widget`](Widget.md).[`_emit`](Widget.md#_emit)

***

### \_scaledBounds()

> **\_scaledBounds**(`cw`, `ch`): `object`

Defined in: [engine/src/ui/widgets/base.ts:320](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/base.ts#L320)

#### Parameters

##### cw

`number`

##### ch

`number`

#### Returns

`object`

##### h

> **h**: `number`

##### w

> **w**: `number`

##### x

> **x**: `number`

##### y

> **y**: `number`

#### Inherited from

[`Widget`](Widget.md).[`_scaledBounds`](Widget.md#_scaledbounds)

***

### \_setHovered()

> **\_setHovered**(`hovered`): `void`

Defined in: [engine/src/ui/widgets/button.ts:60](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/button.ts#L60)

#### Parameters

##### hovered

`boolean`

#### Returns

`void`

#### Overrides

[`Widget`](Widget.md).[`_setHovered`](Widget.md#_sethovered)

***

### \_tick()

> **\_tick**(`dt`): `void`

Defined in: [engine/src/ui/widgets/base.ts:205](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/base.ts#L205)

#### Parameters

##### dt

`number`

#### Returns

`void`

#### Inherited from

[`Widget`](Widget.md).[`_tick`](Widget.md#_tick)

***

### animate()

> **animate**(`name`, `opts?`): `void`

Defined in: [engine/src/ui/widgets/base.ts:193](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/base.ts#L193)

Start an animation. `opts.duration` is in milliseconds (matching the
rest of the widget event API); `_tick(dt)` receives `dt` in seconds
(matching the engine's frame loop), so the duration is converted to
seconds once here rather than at every tick.

#### Parameters

##### name

[`AnimationName`](../type-aliases/AnimationName.md)

##### opts?

[`AnimationOpts`](../interfaces/AnimationOpts.md) = `{}`

#### Returns

`void`

#### Inherited from

[`Widget`](Widget.md).[`animate`](Widget.md#animate)

***

### contains()

> **contains**(`px`, `py`, `cw`, `ch`): `boolean`

Defined in: [engine/src/ui/widgets/base.ts:337](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/base.ts#L337)

#### Parameters

##### px

`number`

##### py

`number`

##### cw

`number`

##### ch

`number`

#### Returns

`boolean`

#### Inherited from

[`Widget`](Widget.md).[`contains`](Widget.md#contains)

***

### off()

> **off**(`event`, `handler`): `void`

Defined in: [engine/src/ui/widgets/base.ts:176](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/base.ts#L176)

#### Parameters

##### event

[`WidgetEvent`](../type-aliases/WidgetEvent.md)

##### handler

(`value?`) => `void`

#### Returns

`void`

#### Inherited from

[`Widget`](Widget.md).[`off`](Widget.md#off)

***

### on()

> **on**(`event`, `handler`): () => `void`

Defined in: [engine/src/ui/widgets/base.ts:166](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/base.ts#L166)

#### Parameters

##### event

[`WidgetEvent`](../type-aliases/WidgetEvent.md)

##### handler

(`value?`) => `void`

#### Returns

() => `void`

#### Inherited from

[`Widget`](Widget.md).[`on`](Widget.md#on)

***

### render()

> **render**(`ctx`, `cw`, `ch`): `void`

Defined in: [engine/src/ui/widgets/button.ts:74](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/button.ts#L74)

#### Parameters

##### ctx

[`IUIRenderer`](../interfaces/IUIRenderer.md)

##### cw

`number`

##### ch

`number`

#### Returns

`void`

#### Overrides

[`Widget`](Widget.md).[`render`](Widget.md#render)

***

### resolvedPosition()

> **resolvedPosition**(`cw`, `ch`): `object`

Defined in: [engine/src/ui/widgets/base.ts:281](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/base.ts#L281)

#### Parameters

##### cw

`number`

##### ch

`number`

#### Returns

`object`

##### x

> **x**: `number`

##### y

> **y**: `number`

#### Inherited from

[`Widget`](Widget.md).[`resolvedPosition`](Widget.md#resolvedposition)

***

### triggerClick()

> **triggerClick**(): `void`

Defined in: [engine/src/ui/widgets/button.ts:69](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/ui/widgets/button.ts#L69)

#### Returns

`void`

#### Overrides

[`Widget`](Widget.md).[`triggerClick`](Widget.md#triggerclick)

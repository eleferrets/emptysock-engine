[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / Widget

# Abstract Class: Widget

Defined in: [engine/src/ui/widgets/base.ts:124](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/ui/widgets/base.ts#L124)

## Extended by

- [`LabelWidget`](LabelWidget.md)
- [`ImageWidget`](ImageWidget.md)
- [`ButtonWidget`](ButtonWidget.md)
- [`PanelWidget`](PanelWidget.md)
- [`ProgressBarWidget`](ProgressBarWidget.md)
- [`SliderWidget`](SliderWidget.md)
- [`CheckboxWidget`](CheckboxWidget.md)

## Constructors

### Constructor

> **new Widget**(`opts?`): `Widget`

Defined in: [engine/src/ui/widgets/base.ts:155](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/ui/widgets/base.ts#L155)

#### Parameters

##### opts?

`BaseWidgetOpts` = `{}`

#### Returns

`Widget`

## Properties

### \_anim

> **\_anim**: `ActiveAnim` \| `null` = `null`

Defined in: [engine/src/ui/widgets/base.ts:135](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/ui/widgets/base.ts#L135)

***

### \_animDx

> **\_animDx**: `number` = `0`

Defined in: [engine/src/ui/widgets/base.ts:136](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/ui/widgets/base.ts#L136)

***

### \_animDy

> **\_animDy**: `number` = `0`

Defined in: [engine/src/ui/widgets/base.ts:137](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/ui/widgets/base.ts#L137)

***

### \_hovered

> **\_hovered**: `boolean` = `false`

Defined in: [engine/src/ui/widgets/base.ts:140](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/ui/widgets/base.ts#L140)

***

### \_scaleX

> **\_scaleX**: `number` = `1`

Defined in: [engine/src/ui/widgets/base.ts:138](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/ui/widgets/base.ts#L138)

***

### \_scaleY

> **\_scaleY**: `number` = `1`

Defined in: [engine/src/ui/widgets/base.ts:139](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/ui/widgets/base.ts#L139)

***

### alpha

> **alpha**: `number`

Defined in: [engine/src/ui/widgets/base.ts:132](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/ui/widgets/base.ts#L132)

***

### anchor

> **anchor**: [`WidgetAnchor`](../type-aliases/WidgetAnchor.md)

Defined in: [engine/src/ui/widgets/base.ts:130](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/ui/widgets/base.ts#L130)

***

### children

> `readonly` **children**: `Widget`[] = `[]`

Defined in: [engine/src/ui/widgets/base.ts:133](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/ui/widgets/base.ts#L133)

***

### height

> **height**: `number`

Defined in: [engine/src/ui/widgets/base.ts:129](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/ui/widgets/base.ts#L129)

***

### id

> `readonly` **id**: `number`

Defined in: [engine/src/ui/widgets/base.ts:125](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/ui/widgets/base.ts#L125)

***

### uiScale

> **uiScale**: `number` = `1`

Defined in: [engine/src/ui/widgets/base.ts:148](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/ui/widgets/base.ts#L148)

Uniform display scale applied on top of `width`/`height`/`x`/`y` when
resolving screen-space position and hit-testing, intended to be driven
by the canvas-to-design-resolution ratio (e.g. from a future
ViewportSystem, or `UISystem.setScale`). Defaults to 1 — unscaled.

***

### visible

> **visible**: `boolean`

Defined in: [engine/src/ui/widgets/base.ts:131](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/ui/widgets/base.ts#L131)

***

### width

> **width**: `number`

Defined in: [engine/src/ui/widgets/base.ts:128](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/ui/widgets/base.ts#L128)

***

### x

> **x**: `number`

Defined in: [engine/src/ui/widgets/base.ts:126](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/ui/widgets/base.ts#L126)

***

### y

> **y**: `number`

Defined in: [engine/src/ui/widgets/base.ts:127](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/ui/widgets/base.ts#L127)

## Methods

### \_emit()

> **\_emit**(`event`, `value?`): `void`

Defined in: [engine/src/ui/widgets/base.ts:183](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/ui/widgets/base.ts#L183)

#### Parameters

##### event

[`WidgetEvent`](../type-aliases/WidgetEvent.md)

##### value?

`unknown`

#### Returns

`void`

***

### \_scaledBounds()

> **\_scaledBounds**(`cw`, `ch`): `object`

Defined in: [engine/src/ui/widgets/base.ts:320](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/ui/widgets/base.ts#L320)

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

***

### \_setHovered()

> **\_setHovered**(`hovered`): `void`

Defined in: [engine/src/ui/widgets/base.ts:348](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/ui/widgets/base.ts#L348)

#### Parameters

##### hovered

`boolean`

#### Returns

`void`

***

### \_tick()

> **\_tick**(`dt`): `void`

Defined in: [engine/src/ui/widgets/base.ts:205](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/ui/widgets/base.ts#L205)

#### Parameters

##### dt

`number`

#### Returns

`void`

***

### animate()

> **animate**(`name`, `opts?`): `void`

Defined in: [engine/src/ui/widgets/base.ts:193](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/ui/widgets/base.ts#L193)

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

***

### contains()

> **contains**(`px`, `py`, `cw`, `ch`): `boolean`

Defined in: [engine/src/ui/widgets/base.ts:337](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/ui/widgets/base.ts#L337)

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

***

### off()

> **off**(`event`, `handler`): `void`

Defined in: [engine/src/ui/widgets/base.ts:176](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/ui/widgets/base.ts#L176)

#### Parameters

##### event

[`WidgetEvent`](../type-aliases/WidgetEvent.md)

##### handler

(`value?`) => `void`

#### Returns

`void`

***

### on()

> **on**(`event`, `handler`): () => `void`

Defined in: [engine/src/ui/widgets/base.ts:166](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/ui/widgets/base.ts#L166)

#### Parameters

##### event

[`WidgetEvent`](../type-aliases/WidgetEvent.md)

##### handler

(`value?`) => `void`

#### Returns

() => `void`

***

### render()

> `abstract` **render**(`ctx`, `cw`, `ch`): `void`

Defined in: [engine/src/ui/widgets/base.ts:354](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/ui/widgets/base.ts#L354)

#### Parameters

##### ctx

[`IUIRenderer`](../interfaces/IUIRenderer.md)

##### cw

`number`

##### ch

`number`

#### Returns

`void`

***

### resolvedPosition()

> **resolvedPosition**(`cw`, `ch`): `object`

Defined in: [engine/src/ui/widgets/base.ts:281](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/ui/widgets/base.ts#L281)

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

***

### triggerClick()

> **triggerClick**(): `void`

Defined in: [engine/src/ui/widgets/base.ts:343](https://github.com/eleferrets/emptysock-engine/blob/b99bc83f395a2a008bf7f96e63875520cb9c5b89/packages/engine/src/ui/widgets/base.ts#L343)

#### Returns

`void`

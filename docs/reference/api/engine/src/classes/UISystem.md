[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / UISystem

# Class: UISystem

Defined in: engine/src/ui/UISystem.ts:58

`UISystem`, built on `WidgetTree`'s
entity-per-widget layout foundation (ground rule 4a) and the widget-kind
components in `components/Widgets.ts`. Covers hit-testing,
press/drag/click/hover dispatch, and rendering against a `Scene`'s live
widget tree. Deliberately does not implement per-widget animation, anchor
resolution, or image bitmap loading/caching (see `Widgets.ts`'s class doc
comment) — those are real, separately tracked follow-ups, not silently
dropped.

## Constructors

### Constructor

> **new UISystem**(`_tree`, `options?`): `UISystem`

Defined in: engine/src/ui/UISystem.ts:67

#### Parameters

##### \_tree

[`WidgetTree`](WidgetTree.md)

##### options?

`UISystemOptions` = `{}`

#### Returns

`UISystem`

## Methods

### cancelPointer()

> **cancelPointer**(`pointerId?`): `void`

Defined in: engine/src/ui/UISystem.ts:319

Abort an in-flight press without triggering a click (e.g. `pointercancel`).

#### Parameters

##### pointerId?

`number` = `0`

#### Returns

`void`

***

### dispatchPointerDown()

> **dispatchPointerDown**(`scene`, `x`, `y`, `pointerId?`): [`Entity`](Entity.md) \| `undefined`

Defined in: engine/src/ui/UISystem.ts:271

Begin a press on the topmost widget under `(x, y)`. Does not fire a click — see `dispatchPointerUp`. `pointerId` distinguishes simultaneous multi-touch presses (default 0 for a single mouse pointer).

#### Parameters

##### scene

[`Scene`](Scene.md)

##### x

`number`

##### y

`number`

##### pointerId?

`number` = `0`

#### Returns

[`Entity`](Entity.md) \| `undefined`

***

### dispatchPointerDrag()

> **dispatchPointerDrag**(`scene`, `x`, `y`, `pointerId?`): `void`

Defined in: engine/src/ui/UISystem.ts:292

Update an in-flight press's position. Past `CLICK_DRAG_THRESHOLD` from its start point, the press is a drag and will not fire a click on release. A slider being dragged updates its value live.

#### Parameters

##### scene

[`Scene`](Scene.md)

##### x

`number`

##### y

`number`

##### pointerId?

`number` = `0`

#### Returns

`void`

***

### dispatchPointerUp()

> **dispatchPointerUp**(`scene`, `x`, `y`, `pointerId?`): `boolean`

Defined in: engine/src/ui/UISystem.ts:301

Complete a press started with `dispatchPointerDown`. Fires the widget's click behaviour (toggling a `Checkbox`, applying a `Slider`'s final value) only if the press was not a drag and release still lands on the same widget's box. Returns whether a click fired.

#### Parameters

##### scene

[`Scene`](Scene.md)

##### x

`number`

##### y

`number`

##### pointerId?

`number` = `0`

#### Returns

`boolean`

***

### hitTest()

> **hitTest**(`scene`, `x`, `y`): [`Entity`](Entity.md) \| `undefined`

Defined in: engine/src/ui/UISystem.ts:249

Topmost widget under `(x, y)`, or `undefined`. `WidgetTree.orderedWidgets()`
returns root-first order; walking it in reverse visits the most
recently added leaf-most widgets first, giving "children win over their
The parent, later siblings win over earlier ones" without needing a
second recursive per-level pass.

#### Parameters

##### scene

[`Scene`](Scene.md)

##### x

`number`

##### y

`number`

#### Returns

[`Entity`](Entity.md) \| `undefined`

***

### render()

> **render**(`scene`, `ctx`): `void`

Defined in: engine/src/ui/UISystem.ts:355

Draws every visible widget in `scene` to `ctx`, root-first (so a parent's background paints before its children).

#### Parameters

##### scene

[`Scene`](Scene.md)

##### ctx

`IUIRenderer`

#### Returns

`void`

***

### updateHover()

> **updateHover**(`scene`, `x`, `y`): `void`

Defined in: engine/src/ui/UISystem.ts:329

Update hover state (`ButtonState.state`) for every non-disabled button widget given the current pointer position. Call once per frame from a pointer-move handler.

#### Parameters

##### scene

[`Scene`](Scene.md)

##### x

`number`

##### y

`number`

#### Returns

`void`

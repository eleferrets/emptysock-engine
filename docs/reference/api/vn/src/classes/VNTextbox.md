[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [vn/src](../README.md) / VNTextbox

# Class: VNTextbox

Defined in: vn/src/VNTextbox.ts:86

VNTextbox — a pre-built dialogue box. Spawns real widget entities
(`PanelStyle`/`Label`, positioned via `LayoutStyle`) through the caller's
`WidgetTree`, and the caller renders them the same way it renders every
other widget entity: `uiSystem.render(scene, ctx)`. There is no
per-widget click-callback mechanism in the UI layer (state lives on
components, game code polls it) — this class exposes its own
`handlePointerDown(x, y)` hit-test instead of relying on one, the same
"a panel isn't a button, so it gets its own hit-test" shape a bespoke
interactive panel would need.

Call `bind(vnSystem)` to wire it to a `VNSystem` instance — it will
automatically update whenever the current node changes. Call `update(dt)`
every frame so the typewriter animation advances.

## Example

```typescript
const textbox = new VNTextbox({
  canvasWidth: 800,
  canvasHeight: 600,
  scene,
  tree,
  typewriterSpeed: 40,
});
textbox.bind(myVnSystem);

// In onUpdate:
textbox.update(dt);
tree.layout(scene, 800, 600);

// In the render callback:
uiSystem.render(scene, ctx);
```

## Constructors

### Constructor

> **new VNTextbox**(`opts`): `VNTextbox`

Defined in: vn/src/VNTextbox.ts:110

#### Parameters

##### opts

[`VNTextboxOptions`](../interfaces/VNTextboxOptions.md)

#### Returns

`VNTextbox`

## Accessors

### isTyping

#### Get Signature

> **get** **isTyping**(): `boolean`

Defined in: vn/src/VNTextbox.ts:219

True while a typewriter reveal is in progress.

##### Returns

`boolean`

***

### visible

#### Get Signature

> **get** **visible**(): `boolean`

Defined in: vn/src/VNTextbox.ts:214

##### Returns

`boolean`

#### Set Signature

> **set** **visible**(`v`): `void`

Defined in: vn/src/VNTextbox.ts:209

Show or hide the textbox.

##### Parameters

###### v

`boolean`

##### Returns

`void`

## Methods

### bind()

> **bind**(`vn`): `void`

Defined in: vn/src/VNTextbox.ts:203

Wire this textbox to a VNSystem instance. The textbox immediately reflects the current node.

#### Parameters

##### vn

[`VNSystem`](VNSystem.md)

#### Returns

`void`

***

### destroy()

> **destroy**(): `void`

Defined in: vn/src/VNTextbox.ts:371

Destroy the textbox's widget entities. Call when the scene unloads.

#### Returns

`void`

***

### handlePointerDown()

> **handlePointerDown**(`x`, `y`): `boolean`

Defined in: vn/src/VNTextbox.ts:264

Hit-tests `(x, y)` against the panel's current on-screen box (post-
`tree.layout()`) and advances/skips as if the panel were clicked.
Returns whether the point hit the panel at all, so the caller can
decide whether to also dispatch the point elsewhere.

#### Parameters

##### x

`number`

##### y

`number`

#### Returns

`boolean`

***

### skipTypewriter()

> **skipTypewriter**(): `void`

Defined in: vn/src/VNTextbox.ts:250

Jump the current typewriter reveal to its end immediately.
No-op if no reveal is in progress.

#### Returns

`void`

***

### update()

> **update**(`dt`): `void`

Defined in: vn/src/VNTextbox.ts:226

Advance the typewriter animation. Call once per frame from `onUpdate(dt)`.

#### Parameters

##### dt

`number`

#### Returns

`void`

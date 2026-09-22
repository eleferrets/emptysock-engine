[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [vn/src](../README.md) / VNTextbox

# Class: VNTextbox

Defined in: [vn/src/VNTextbox.ts:71](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/vn/src/VNTextbox.ts#L71)

VNTextbox — a pre-built dialogue box rendered by UISystem.

Creates a PanelWidget anchored to the bottom of the canvas with a speaker
name plate and a text area. Call `bind(vnSystem)` to wire it to a VNSystem
instance — it will automatically update whenever the current node changes.

Call `update(dt)` every frame (or let Scene.update() handle it via the
UISystem it drives automatically) so the typewriter animation advances.

## Example

```typescript
const textbox = new VNTextbox({
  canvasWidth: 800,
  canvasHeight: 600,
  ui: scene.ui,
  typewriterSpeed: 40,  // 40 chars/sec, smart line-break pre-calculation
});
textbox.bind(myVnSystem);

// In onUpdate — advance the typewriter:
textbox.update(dt);

// In the game loop render callback:
scene.ui.render(ctx, 800, 600);
```

## Constructors

### Constructor

> **new VNTextbox**(`opts`): `VNTextbox`

Defined in: [vn/src/VNTextbox.ts:92](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/vn/src/VNTextbox.ts#L92)

#### Parameters

##### opts

[`VNTextboxOptions`](../interfaces/VNTextboxOptions.md)

#### Returns

`VNTextbox`

## Accessors

### isTyping

#### Get Signature

> **get** **isTyping**(): `boolean`

Defined in: [vn/src/VNTextbox.ts:216](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/vn/src/VNTextbox.ts#L216)

True while a typewriter reveal is in progress.

##### Returns

`boolean`

***

### visible

#### Get Signature

> **get** **visible**(): `boolean`

Defined in: [vn/src/VNTextbox.ts:211](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/vn/src/VNTextbox.ts#L211)

##### Returns

`boolean`

#### Set Signature

> **set** **visible**(`v`): `void`

Defined in: [vn/src/VNTextbox.ts:207](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/vn/src/VNTextbox.ts#L207)

Show or hide the textbox.

##### Parameters

###### v

`boolean`

##### Returns

`void`

## Methods

### bind()

> **bind**(`vn`): `void`

Defined in: [vn/src/VNTextbox.ts:201](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/vn/src/VNTextbox.ts#L201)

Wire this textbox to a VNSystem instance. The textbox immediately reflects the current node.

#### Parameters

##### vn

[`VNSystem`](VNSystem.md)

#### Returns

`void`

***

### destroy()

> **destroy**(): `void`

Defined in: [vn/src/VNTextbox.ts:343](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/vn/src/VNTextbox.ts#L343)

Remove the textbox widgets from UISystem. Call when the scene unloads.

#### Returns

`void`

***

### skipTypewriter()

> **skipTypewriter**(): `void`

Defined in: [vn/src/VNTextbox.ts:247](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/vn/src/VNTextbox.ts#L247)

Jump the current typewriter reveal to its end immediately.
No-op if no reveal is in progress.

#### Returns

`void`

***

### update()

> **update**(`dt`): `void`

Defined in: [vn/src/VNTextbox.ts:226](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/vn/src/VNTextbox.ts#L226)

Advance the typewriter animation. Call once per frame from `onUpdate(dt)`.
If the scene's UISystem.update() is called automatically (it is, via
Scene.update()), widget animations already run — this method drives only
the character-reveal logic, which is separate.

#### Parameters

##### dt

`number`

#### Returns

`void`

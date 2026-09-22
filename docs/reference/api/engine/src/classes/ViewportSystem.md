[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / ViewportSystem

# Class: ViewportSystem

Defined in: [engine/src/systems/ViewportSystem.ts:154](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/ViewportSystem.ts#L154)

Owns automatic viewport handling: design-resolution scaling (fit / fill /
stretch), resize + orientation-change listening, and safe-area-inset
exposure. Feeds resize() on the render target (RenderSystem or, typically,
RenderPipeline — the batteries-included rendering path) and
CameraSystem.setViewSize() so the renderer and camera never go stale after
the container changes size.

Safe in Node/Vitest: every DOM access is guarded the same way
RenderSystem guards `window.devicePixelRatio` and WindowSystem guards
`document`/`window` at the call site (see CLAUDE.md's Tauri-detection
pattern — the same style applies to any host-only API).

## Constructors

### Constructor

> **new ViewportSystem**(): `ViewportSystem`

#### Returns

`ViewportSystem`

## Accessors

### config

#### Get Signature

> **get** **config**(): `Readonly`\<[`ViewportConfig`](../interfaces/ViewportConfig.md)\>

Defined in: [engine/src/systems/ViewportSystem.ts:217](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/ViewportSystem.ts#L217)

##### Returns

`Readonly`\<[`ViewportConfig`](../interfaces/ViewportConfig.md)\>

***

### size

#### Get Signature

> **get** **size**(): `Readonly`\<[`ViewportSize`](../interfaces/ViewportSize.md)\>

Defined in: [engine/src/systems/ViewportSystem.ts:213](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/ViewportSystem.ts#L213)

##### Returns

`Readonly`\<[`ViewportSize`](../interfaces/ViewportSize.md)\>

## Methods

### destroy()

> **destroy**(): `void`

Defined in: [engine/src/systems/ViewportSystem.ts:265](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/ViewportSystem.ts#L265)

#### Returns

`void`

***

### getSafeAreaInsets()

> **getSafeAreaInsets**(): [`SafeAreaInsets`](../interfaces/SafeAreaInsets.md)

Defined in: [engine/src/systems/ViewportSystem.ts:238](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/ViewportSystem.ts#L238)

Reads env(safe-area-inset-*) via the standard CSS-custom-property probe
technique: a hidden element with padding set from the env() values, whose
computed styles are then read back in pixels. Returns all-zero insets
outside a browser context or when the platform does not support them.

#### Returns

[`SafeAreaInsets`](../interfaces/SafeAreaInsets.md)

***

### init()

> **init**(`config`, `systems?`): `void`

Defined in: [engine/src/systems/ViewportSystem.ts:173](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/ViewportSystem.ts#L173)

Wire the systems that should be kept in sync on resize, and start
listening. Call once during scene/engine setup.

#### Parameters

##### config

`Partial`\<[`ViewportConfig`](../interfaces/ViewportConfig.md)\>

##### systems?

###### cameraSystem?

[`CameraSystem`](CameraSystem.md)

###### renderTarget?

[`ResizableRenderTarget`](../interfaces/ResizableRenderTarget.md)

#### Returns

`void`

***

### recompute()

> **recompute**(): [`ViewportSize`](../interfaces/ViewportSize.md)

Defined in: [engine/src/systems/ViewportSystem.ts:189](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/ViewportSystem.ts#L189)

Recompute the letterboxed size and push it to RenderSystem + CameraSystem.

#### Returns

[`ViewportSize`](../interfaces/ViewportSize.md)

***

### setDesignResolution()

> **setDesignResolution**(`width`, `height`): `void`

Defined in: [engine/src/systems/ViewportSystem.ts:226](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/ViewportSystem.ts#L226)

#### Parameters

##### width

`number`

##### height

`number`

#### Returns

`void`

***

### setScaleMode()

> **setScaleMode**(`mode`): `void`

Defined in: [engine/src/systems/ViewportSystem.ts:221](https://github.com/eleferrets/emptysock-engine/blob/8ae2998a8719cb4220793bada344be0c018e8882/packages/engine/src/systems/ViewportSystem.ts#L221)

#### Parameters

##### mode

[`ScaleMode`](../type-aliases/ScaleMode.md)

#### Returns

`void`

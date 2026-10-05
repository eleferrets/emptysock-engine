[**emptysock-engine**](../../../README.md)

***

[emptysock-engine](../../../README.md) / [engine/src](../README.md) / SpriteFlash

# Variable: SpriteFlash

> `const` **SpriteFlash**: [`ComponentDef`](../interfaces/ComponentDef.md)\<\{ `active`: `boolean`; `amount`: `number`; `color`: `number`; `duration`: `number`; `easing`: [`EasingName`](../type-aliases/EasingName.md); `elapsed`: `number`; `peak`: `number`; \}\>

Defined in: engine/src/components/SpriteFlash.ts:12

Hit-flash on a `Sprite`: paint the silhouette `color` at `amount` (0..1).
`SpriteFlashSystem` drives `amount` from `peak` down to 0 over `duration`
seconds; the render backend (today a pooled `ColorOverlayFilter` attached
only while `amount > 0`) reads `color`/`amount` and nothing else, so a
Mesh path can replace it without touching this component or the system.
Start a flash with `startSpriteFlash()`.
